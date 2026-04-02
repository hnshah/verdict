/**
 * @verdict/sdk
 * 
 * Programmatic SDK for Verdict LLM evaluation and smart routing
 * 
 * @example
 * ```typescript
 * import { VerdictClient } from '@verdict/sdk';
 * 
 * const client = new VerdictClient();
 * 
 * // Get model stats
 * const model = await client.getModel('qwen2.5-coder:32b');
 * console.log(`Win rate: ${model.winRate}%`);
 * 
 * // Smart routing
 * const route = await client.route({
 *   prompt: "Write a Python function to reverse a string",
 *   domain: "coding"
 * });
 * console.log(`Use: ${route.recommendedModel}`);
 * ```
 */

export { VerdictClient } from './client';
export * from './types';
export { default } from './client';
