import sys
sys.stdout.reconfigure(encoding="utf-8")
import shutil
import time
from datasets import load_dataset

def get_free_space_mb():
    total, used, free = shutil.disk_usage("/")
    return free / (1024 * 1024)

def print_record(record):
    for key in ['query_id', 'query', 'Answer', 'Eng_Query', 'Eng_Answer', 'query_type', 'source_lang', 'target_lang']:
        print(f"{key}: {record.get(key)}")
        
    passages = record.get('passages', {})
    print("passages:")
    for pkey in ['is_selected', 'English_passages', 'Translated_passages']:
        # Truncate lists slightly just so they don't flood the terminal completely, but let's print as requested.
        val = passages.get(pkey)
        if isinstance(val, list) and len(val) > 0:
            if isinstance(val[0], str) and len(val[0]) > 200:
                print(f"  {pkey}: [{val[0][:100]}...]")
            else:
                print(f"  {pkey}: {val}")
        else:
            print(f"  {pkey}: {val}")

def run_language_test(lang_name, url):
    print(f"\n==================================================")
    print(f"TESTING {lang_name.upper()}")
    print(f"==================================================")
    
    initial_space = get_free_space_mb()
    
    t0 = time.time()
    try:
        ds = load_dataset(
            "parquet",
            data_files={"validation": url},
            split="validation",
            streaming=True
        )
        t_obj = time.time() - t0
    except Exception as e:
        print(f"FAILED TO CREATE DATASET OBJECT: {e}")
        return False, {"error": str(e)}

    count = 0
    t_first = None
    
    try:
        iterator = iter(ds.take(5))
        
        # Get first
        t1 = time.time()
        first_record = next(iterator)
        t_first = time.time() - t1
        
        print(f"\n--- {lang_name.capitalize()} Record 1 ---")
        print_record(first_record)
        count = 1
        
        # Get next 4
        for record in iterator:
            count += 1
            print(f"\n--- {lang_name.capitalize()} Record {count} ---")
            print_record(record)
            
        t_total = time.time() - t0
        
        final_space = get_free_space_mb()
        space_used = initial_space - final_space
        
        return True, {
            "t_obj": t_obj,
            "t_first": t_first,
            "t_total": t_total,
            "space_used": space_used,
            "count": count
        }
    except Exception as e:
        print(f"FAILED DURING STREAMING: {e}")
        return False, {"error": str(e)}

def main():
    hi_success, hi_stats = run_language_test(
        "HINDI", 
        "https://huggingface.co/datasets/ai4bharat/MSMARCO-XI/resolve/main/validation/hinval.parquet"
    )
    
    print("\n==================================================")
    print("FINAL REPORT")
    print("==================================================")
    
    print(f"REMOTE PARQUET: {'PASS' if hi_success else 'FAIL'}")
    print(f"STREAMING: {'PASS' if hi_success else 'FAIL'}")
    print(f"REAL RECORDS RECEIVED: {hi_stats.get('count', 0)}/5")
    
    if hi_success:
        full_download = "YES" if hi_stats['space_used'] > 10 else "NO"
        print(f"FULL DATASET DOWNLOADED: {full_download}")
        print(f"DISK USED: {hi_stats['space_used']:.2f} MB")
        print(f"TIME TO FIRST RECORD: {hi_stats['t_first']:.2f} s")
        print(f"TIME TO 5 RECORDS: {hi_stats['t_total']:.2f} s")
    else:
        print(f"Exact Error:\n{hi_stats.get('error')}")

if __name__ == "__main__":
    main()
