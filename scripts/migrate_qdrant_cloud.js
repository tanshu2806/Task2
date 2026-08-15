const LOCAL_URL = "http://localhost:6333";
const COLLECTION = "msmarco_xi";

// Put these in environment variables before running.
// DO NOT hardcode your real API key.
const CLOUD_URL = process.env.QDRANT_CLOUD_URL;
const CLOUD_API_KEY = process.env.QDRANT_CLOUD_API_KEY;

if (!CLOUD_URL || !CLOUD_API_KEY) {
    throw new Error(
        "Missing QDRANT_CLOUD_URL or QDRANT_CLOUD_API_KEY environment variables."
    );
}

const localHeaders = {
    "Content-Type": "application/json"
};

const cloudHeaders = {
    "Content-Type": "application/json",
    "api-key": CLOUD_API_KEY
};

async function localRequest(path, options = {}) {
    const response = await fetch(`${LOCAL_URL}${path}`, {
        ...options,
        headers: {
            ...localHeaders,
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        throw new Error(
            `Local Qdrant ${response.status}: ${await response.text()}`
        );
    }

    return response.json();
}

async function cloudRequest(path, options = {}) {
    const response = await fetch(`${CLOUD_URL}${path}`, {
        ...options,
        headers: {
            ...cloudHeaders,
            ...(options.headers || {})
        }
    });

    if (!response.ok) {
        throw new Error(
            `Cloud Qdrant ${response.status}: ${await response.text()}`
        );
    }

    return response.json();
}

async function main() {
    console.log("======================================");
    console.log("QDRANT CLOUD MIGRATION");
    console.log("======================================");

    // --------------------------------------------------
    // 1. Inspect local collection
    // --------------------------------------------------

    const localInfo =
        await localRequest(`/collections/${COLLECTION}`);

    const config = localInfo.result.config.params.vectors;

    console.log("\nLOCAL COLLECTION");
    console.log("Collection:", COLLECTION);
    console.log("Points:", localInfo.result.points_count);
    console.log("Vector size:", config.size);
    console.log("Distance:", config.distance);

    // --------------------------------------------------
    // 2. Check whether cloud collection exists
    // --------------------------------------------------

    const cloudCollections =
        await cloudRequest("/collections");

    const exists =
        cloudCollections.result.collections
            .some(c => c.name === COLLECTION);

    if (!exists) {
        console.log("\nCreating cloud collection...");

        await cloudRequest(`/collections/${COLLECTION}`, {
            method: "PUT",
            body: JSON.stringify({
                vectors: {
                    size: config.size,
                    distance: config.distance
                },
                shard_number: 1
            })
        });

        console.log("Cloud collection created.");
    } else {
        console.log("\nCloud collection already exists.");
    }

    // --------------------------------------------------
    // 3. Copy points in batches
    // --------------------------------------------------

    const BATCH_SIZE = 100;

    let offset = null;
    let totalUploaded = 0;

    while (true) {
        const requestBody = {
            limit: BATCH_SIZE,
            with_payload: true,
            with_vector: true
        };

        if (offset !== null) {
            requestBody.offset = offset;
        }

        const batch =
            await localRequest(
                `/collections/${COLLECTION}/points/scroll`,
                {
                    method: "POST",
                    body: JSON.stringify(requestBody)
                }
            );

        const points = batch.result.points;

        if (!points.length) {
            break;
        }

        await cloudRequest(
            `/collections/${COLLECTION}/points?wait=true`,
            {
                method: "PUT",
                body: JSON.stringify({
                    points
                })
            }
        );

        totalUploaded += points.length;

        console.log(
            `Uploaded ${totalUploaded} / ${localInfo.result.points_count}`
        );

        offset = batch.result.next_page_offset;

        if (offset === null || offset === undefined) {
            break;
        }
    }

    // --------------------------------------------------
    // 4. Verify cloud count
    // --------------------------------------------------

    const cloudCount =
        await cloudRequest(
            `/collections/${COLLECTION}/points/count`,
            {
                method: "POST",
                body: JSON.stringify({
                    exact: true
                })
            }
        );

    console.log("\n======================================");
    console.log("MIGRATION COMPLETE");
    console.log("======================================");

    console.log("Local points :", localInfo.result.points_count);
    console.log("Uploaded     :", totalUploaded);
    console.log(
        "Cloud points :",
        cloudCount.result.count
    );

    if (
        cloudCount.result.count ===
        localInfo.result.points_count
    ) {
        console.log("\n✓ POINT COUNT MATCHES");
        console.log("✓ Migration successful");
    } else {
        console.error("\n✗ POINT COUNT DOES NOT MATCH");
        process.exit(1);
    }
}

main().catch(error => {
    console.error("\nMIGRATION FAILED");
    console.error(error.message);
    process.exit(1);
});