/**
 * Generate HuggingFace links for models
 */

export function getHuggingFaceLink(modelId: string): string | null {
  // Common patterns for model IDs
  const patterns = [
    // qwen2.5:7b, qwen2.5-coder:7b
    { regex: /^qwen2\.5-coder:?(\d+b)?$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/Qwen/Qwen2.5-Coder-${m[1] || '7B'}` },
    { regex: /^qwen2\.5:?(\d+b)?$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/Qwen/Qwen2.5-${m[1] || '7B'}` },
    { regex: /^qwen:?(\d+b)?$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/Qwen/Qwen2-${m[1] || '7B'}` },
    
    // llama3.2:3b, llama-3.2:3b
    { regex: /^llama-?3\.2:?(\d+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/meta-llama/Llama-3.2-${m[1].toUpperCase()}` },
    { regex: /^llama-?3\.1:?(\d+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/meta-llama/Llama-3.1-${m[1].toUpperCase()}` },
    { regex: /^llama-?3:?(\d+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/meta-llama/Meta-Llama-3-${m[1].toUpperCase()}` },
    
    // codellama:13b
    { regex: /^codellama:?(\d+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/codellama/CodeLlama-${m[1]}-hf` },
    
    // deepseek-coder:6.7b, deepseek-coder-v2:16b
    { regex: /^deepseek-coder(?:-v2)?:?([\d.]+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/deepseek-ai/deepseek-coder-${m[1]}-base` },
    
    // mistral:7b
    { regex: /^mistral:?(\d+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/mistralai/Mistral-${m[1].toUpperCase()}-v0.1` },
    
    // gemma:2b, gemma:7b
    { regex: /^gemma:?(\d+b)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/google/gemma-${m[1]}-it` },
    
    // phi3:mini, phi3:medium
    { regex: /^phi-?3:(mini|medium)$/i, url: (m: RegExpMatchArray) => `https://huggingface.co/microsoft/Phi-3-${m[1]}-4k-instruct` },
  ]
  
  // Normalize modelId
  const normalized = modelId.toLowerCase().trim()
  
  // Try each pattern
  for (const { regex, url } of patterns) {
    const match = normalized.match(regex)
    if (match) {
      return url(match)
    }
  }
  
  // Fallback: search HF
  const searchQuery = encodeURIComponent(modelId.replace(/[:\-]/g, ' '))
  return `https://huggingface.co/models?search=${searchQuery}`
}

export function getOllamaLink(modelId: string): string {
  // Extract base model name (before colon)
  const baseName = modelId.split(':')[0]
  return `https://ollama.com/library/${baseName}`
}

export function getModelDisplayName(modelId: string): string {
  // Convert model ID to display name
  // qwen2.5-coder:7b → Qwen 2.5 Coder 7B
  // llama3.2:3b → Llama 3.2 3B
  
  const parts = modelId.split(':')
  const name = parts[0]
  const size = parts[1]
  
  // Capitalize and space out
  let display = name
    .replace(/([a-z])(\d)/g, '$1 $2') // Add space before numbers
    .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  
  // Add size if present
  if (size) {
    display += ` ${size.toUpperCase()}`
  }
  
  return display
}
