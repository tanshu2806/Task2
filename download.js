const fs = require('fs');
const https = require('https');

const url = 'https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet';
const dest = 'hinval.parquet';

console.log(`Downloading ${url} to ${dest}...`);

const file = fs.createWriteStream(dest);
https.get(url, (response) => {
    if (response.statusCode === 301 || response.statusCode === 302) {
        console.log(`Following redirect to: ${response.headers.location}`);
        https.get(response.headers.location, (res) => {
            const total = parseInt(res.headers['content-length'], 10);
            let downloaded = 0;
            res.on('data', (chunk) => {
                downloaded += chunk.length;
                process.stdout.write(`\rProgress: ${(downloaded / 1024 / 1024).toFixed(2)} MB / ${(total / 1024 / 1024).toFixed(2)} MB`);
            });
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('\nDownload complete.');
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            console.error('Download failed:', err.message);
        });
    } else {
        response.pipe(file);
    }
}).on('error', (err) => {
    fs.unlink(dest, () => {});
    console.error('Download failed:', err.message);
});
