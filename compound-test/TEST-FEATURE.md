# Test Feature: Auto-Contribute Eval Results

## Goal
Automatically contribute verdict eval results to the dashboard after each run.

## Current Workflow
1. Run verdict eval manually
2. Remember to contribute
3. Run `verdict contribute` with flags
4. Check dashboard updated

## Desired Workflow
1. Run verdict eval
2. Auto-contribute if successful
3. Dashboard updates automatically

## Requirements
- Detect successful eval completion
- Extract result file path
- Call verdict contribute with correct flags
- Handle auth (GitHub token)
- Report status to user

## Constraints
- Don't auto-contribute failed runs
- Preserve ability to manually contribute
- Don't break existing workflow
