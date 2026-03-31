#!/usr/bin/env python3
"""
Convert HuggingFace datasets to Verdict YAML format
Usage: python convert-datasets.py <dataset-name> [--sample N] [--split test]
"""

import argparse
import yaml
from datasets import load_dataset
import random

def convert_mmlu(dataset, sample_size=None):
    """Convert MMLU to verdict format"""
    cases = []
    
    # MMLU has 57 subjects, sample across all
    all_samples = []
    for item in dataset:
        all_samples.append({
            'id': f"mmlu-{item['subject']}-{len(all_samples)+1:04d}",
            'description': f"MMLU {item['subject']} question",
            'category': item['subject'],
            'prompt': f"{item['question']}\n\nA) {item['choices'][0]}\nB) {item['choices'][1]}\nC) {item['choices'][2]}\nD) {item['choices'][3]}",
            'criteria': f"Correct answer: {chr(65 + item['answer'])}",
            'tags': ['mmlu', item['subject'], 'multiple-choice']
        })
    
    # Sample if requested
    if sample_size and sample_size < len(all_samples):
        all_samples = random.sample(all_samples, sample_size)
    
    return {
        'name': 'MMLU (Massive Multitask Language Understanding)',
        'version': '1.0.0',
        'description': f'MMLU benchmark - {len(all_samples)} questions across multiple subjects. Tests general knowledge and reasoning.',
        'cases': all_samples
    }

def convert_gsm8k(dataset, sample_size=None):
    """Convert GSM8K to verdict format"""
    cases = []
    
    for idx, item in enumerate(dataset):
        # Extract answer (usually after "####")
        answer = item['answer'].split('####')[-1].strip() if '####' in item['answer'] else item['answer']
        
        cases.append({
            'id': f"gsm8k-{idx+1:04d}",
            'description': "Grade school math word problem",
            'category': 'math-reasoning',
            'prompt': item['question'],
            'criteria': f"Correct answer: {answer}",
            'tags': ['gsm8k', 'math', 'reasoning', 'word-problems']
        })
        
        if sample_size and len(cases) >= sample_size:
            break
    
    return {
        'name': 'GSM8K (Grade School Math 8K)',
        'version': '1.0.0',
        'description': f'GSM8K benchmark - {len(cases)} grade school math word problems requiring multi-step reasoning.',
        'cases': cases
    }

def convert_hellaswag(dataset, sample_size=None):
    """Convert HellaSwag to verdict format"""
    cases = []
    
    for idx, item in enumerate(dataset):
        # Format the endings as choices
        endings = item['endings']
        choices_text = '\n\n'.join([f"{chr(65+i)}) {e}" for i, e in enumerate(endings)])
        correct = chr(65 + int(item['label']))
        
        cases.append({
            'id': f"hellaswag-{idx+1:05d}",
            'description': "Commonsense reasoning - sentence completion",
            'category': 'commonsense',
            'prompt': f"{item['ctx']}\n\nChoose the most likely continuation:\n\n{choices_text}",
            'criteria': f"Correct answer: {correct}",
            'tags': ['hellaswag', 'commonsense', 'reasoning']
        })
        
        if sample_size and len(cases) >= sample_size:
            break
    
    return {
        'name': 'HellaSwag (Commonsense Reasoning)',
        'version': '1.0.0',
        'description': f'HellaSwag benchmark - {len(cases)} commonsense natural language inference tasks.',
        'cases': cases
    }

def convert_arc(dataset, sample_size=None, challenge_only=True):
    """Convert ARC to verdict format"""
    cases = []
    
    for idx, item in enumerate(dataset):
        # Format choices
        choices = item['choices']
        choices_text = '\n\n'.join([f"{label}) {text}" for label, text in zip(choices['label'], choices['text'])])
        
        cases.append({
            'id': f"arc-{'challenge' if challenge_only else 'easy'}-{idx+1:04d}",
            'description': "Science reasoning question",
            'category': 'science-reasoning',
            'prompt': f"{item['question']}\n\n{choices_text}",
            'criteria': f"Correct answer: {item['answerKey']}",
            'tags': ['arc', 'science', 'reasoning', 'multiple-choice']
        })
        
        if sample_size and len(cases) >= sample_size:
            break
    
    return {
        'name': f"ARC {'Challenge' if challenge_only else 'Easy'} (AI2 Reasoning Challenge)",
        'version': '1.0.0',
        'description': f'ARC benchmark - {len(cases)} grade-school science questions requiring reasoning.',
        'cases': cases
    }

def convert_truthfulqa(dataset, sample_size=None):
    """Convert TruthfulQA to verdict format"""
    cases = []
    
    for idx, item in enumerate(dataset):
        cases.append({
            'id': f"truthfulqa-{idx+1:03d}",
            'description': f"Truthfulness test - {item['category']}",
            'category': item['category'],
            'prompt': item['question'],
            'criteria': f"Best answer: {item['best_answer']}\nAvoid: {', '.join(item.get('incorrect_answers', [])[:3])}",
            'tags': ['truthfulqa', 'safety', 'truthfulness', item['category']]
        })
        
        if sample_size and len(cases) >= sample_size:
            break
    
    return {
        'name': 'TruthfulQA (Truthfulness)',
        'version': '1.0.0',
        'description': f'TruthfulQA benchmark - {len(cases)} questions testing ability to avoid false information.',
        'cases': cases
    }

# Dataset converters mapping
CONVERTERS = {
    'mmlu': ('cais/mmlu', 'test', convert_mmlu),
    'gsm8k': ('openai/gsm8k', 'test', convert_gsm8k),
    'hellaswag': ('Rowan/hellaswag', 'validation', convert_hellaswag),
    'arc': ('allenai/ai2_arc', 'ARC-Challenge', convert_arc),
    'truthfulqa': ('truthful_qa', 'validation', convert_truthfulqa),
}

def main():
    parser = argparse.ArgumentParser(description='Convert HF datasets to Verdict YAML')
    parser.add_argument('dataset', choices=list(CONVERTERS.keys()), help='Dataset to convert')
    parser.add_argument('--sample', type=int, help='Number of samples to take (default: all)')
    parser.add_argument('--output', help='Output YAML file (default: eval-packs/{dataset}.yaml)')
    
    args = parser.parse_args()
    
    # Get converter
    hf_name, split, converter = CONVERTERS[args.dataset]
    
    print(f"📦 Loading {hf_name} ({split} split)...")
    try:
        dataset = load_dataset(hf_name, split=split, trust_remote_code=True)
    except:
        print(f"   Trying without split specification...")
        dataset = load_dataset(hf_name, trust_remote_code=True)
        if isinstance(dataset, dict):
            dataset = dataset.get(split, list(dataset.values())[0])
    
    print(f"   Loaded {len(dataset)} examples")
    
    print(f"🔄 Converting to Verdict format...")
    verdict_data = converter(dataset, args.sample)
    
    # Determine output path
    output = args.output or f"eval-packs/{args.dataset}-hf.yaml"
    
    print(f"💾 Writing to {output}...")
    with open(output, 'w') as f:
        yaml.dump(verdict_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    
    print(f"✅ Done! {len(verdict_data['cases'])} cases written to {output}")
    print(f"\nTo run:")
    print(f"  verdict run --pack {output}")

if __name__ == '__main__':
    main()
