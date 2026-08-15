import datasets
from datasets import load_dataset
import json

def inspect():
    print('Loading dataset...')
    ds = load_dataset('ai4bharat/MSMARCO-XI', name='default', split='train', streaming=True)
    
    examples = []
    iterator = iter(ds)
    for _ in range(5):
        try:
            examples.append(next(iterator))
        except StopIteration:
            break
            
    print(f'Columns in the dataset: {list(examples[0].keys()) if examples else "None"}')
    print('Data Types:')
    if examples:
        for k, v in examples[0].items():
            print(f'  {k}: {type(v).__name__}')
            
    print('\nFirst Example:')
    print(json.dumps(examples[0], indent=2))
    
    builder = datasets.load_dataset_builder('ai4bharat/MSMARCO-XI', name='default')
    info = builder.info
    print('\nDataset Info:')
    if info.splits and 'train' in info.splits:
        print(f'Approximate size (train split): {info.splits["train"].num_examples} examples')
    else:
        print('Size not explicitly available in metadata.')

if __name__ == '__main__':
    inspect()
