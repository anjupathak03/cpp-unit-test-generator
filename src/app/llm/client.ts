import { Ollama } from 'ollama';
import { GenerateResponse } from 'ollama/src/interfaces.js';
import { LlmReply } from '../prompt/schema.js';
import yaml from 'js-yaml';
import chalk from 'chalk';

// Initialize Ollama instance with the specific host
const ollama = new Ollama({ host: 'http://192.168.176.69:11434' });

export async function fetch(prompt: string, signal?: AbortSignal): Promise<LlmReply> {
  console.log(chalk.blue('🤖 Initializing LLM request...'));
  console.log(chalk.gray(`📝 Prompt length: ${prompt.length} characters`));
  
  // Create a promise that rejects when the signal is aborted
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal) {
      signal.addEventListener('abort', () => reject(new Error('Request aborted')));
    }
  });

  console.log(chalk.blue('🚀 Sending request to Ollama...'));
  // Create the Ollama request promise
  const ollamaPromise = ollama.generate({
    model: 'gemma:7b',
    prompt: prompt,
    stream: false
  }) as Promise<GenerateResponse>;

  // Race between the Ollama request and the abort signal
  const ollamaResponse = await Promise.race([ollamaPromise, abortPromise]);
  console.log(chalk.green('✅ Raw response received from Ollama'));

  // Extract the response content from the Ollama response
  const responseText = ollamaResponse.response;
  if (!responseText) {
    console.log(chalk.red('❌ No response content received from LLM'));
    throw new Error('No response content received from LLM');
  }
  
  console.log(chalk.gray(`📥 Response length: ${responseText.length} characters`));

  console.log(chalk.blue('🔧 Processing response...'));
  // Remove markdown code block markers if present
  let yamlContent = responseText.trim();
  if (yamlContent.startsWith('```yaml')) {
    yamlContent = yamlContent.substring(7); // Remove ```yaml
    console.log(chalk.gray('📝 Removed ```yaml markers'));
  }
  if (yamlContent.startsWith('```')) {
    yamlContent = yamlContent.substring(3); // Remove ```
    console.log(chalk.gray('📝 Removed ``` markers'));
  }
  if (yamlContent.endsWith('```')) {
    yamlContent = yamlContent.substring(0, yamlContent.length - 3); // Remove ```
    console.log(chalk.gray('📝 Removed trailing ``` markers'));
  }
  
  yamlContent = yamlContent.trim();

  console.log(chalk.blue('🔍 Parsing YAML content...'));
  try {
    // Parse the YAML content
    const parsed = yaml.load(yamlContent) as LlmReply;
    
    // Validate that we have the expected structure
    if (!parsed || typeof parsed !== 'object') {
      console.log(chalk.red('❌ Parsed response is not an object'));
      throw new Error('Parsed response is not an object');
    }
    
    if (!parsed.tests || !Array.isArray(parsed.tests)) {
      console.log(chalk.red('❌ Response does not contain tests array'));
      throw new Error('Response does not contain tests array');
    }

    console.log(chalk.green(`✅ Found ${parsed.tests.length} test(s) in response`));

    console.log(chalk.blue('🔧 Processing includes field...'));
    // Fix the includes field for each test - convert from YAML block scalar to array
    for (const test of parsed.tests) {
      if (test.includes && typeof test.includes === 'string') {
        // Parse the YAML block scalar string into an array
        const includesString = test.includes as string;
        const includesLines = includesString
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.startsWith('- '))
          .map((line: string) => line.substring(2).trim()); // Remove the "- " prefix
        
        (test as any).includes = includesLines;
        console.log(chalk.gray(`  📝 Processed includes for test "${test.name}": ${includesLines.length} items`));
      } else if (!test.includes) {
        (test as any).includes = [];
        console.log(chalk.gray(`  📝 No includes for test "${test.name}"`));
      }
    }

    console.log(chalk.green('✅ LLM response processed successfully'));
    return parsed;
  } catch (error) {
    console.log(chalk.red('❌ Failed to parse LLM response'));
    throw new Error(`Failed to parse LLM response as YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch raw text response from LLM for test fixing
 * @param prompt The prompt to send to the LLM
 * @param signal AbortSignal for cancellation
 * @returns Raw text response
 */
export async function fetchRawText(prompt: string, signal?: AbortSignal): Promise<string> {
  console.log(chalk.blue('🤖 Initializing LLM request for raw text...'));
  console.log(chalk.gray(`📝 Prompt length: ${prompt.length} characters`));
  
  // Create a promise that rejects when the signal is aborted
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal) {
      signal.addEventListener('abort', () => reject(new Error('Request aborted')));
    }
  });

  console.log(chalk.blue('🚀 Sending request to Ollama...'));
  // Create the Ollama request promise
  const ollamaPromise = ollama.generate({
    model: 'gemma:7b',
    prompt: prompt,
    stream: false
  }) as Promise<GenerateResponse>;

  // Race between the Ollama request and the abort signal
  const ollamaResponse = await Promise.race([ollamaPromise, abortPromise]);
  console.log(chalk.green('✅ Raw response received from Ollama'));

  // Extract the response content from the Ollama response
  const responseText = ollamaResponse.response;
  if (!responseText) {
    console.log(chalk.red('❌ No response content received from LLM'));
    throw new Error('No response content received from LLM');
  }
  
  console.log(chalk.gray(`📥 Response length: ${responseText.length} characters`));

  console.log(chalk.blue('🔧 Processing raw text response...'));
  // Remove markdown code block markers if present
  let processedText = responseText.trim();
  if (processedText.startsWith('```cpp')) {
    processedText = processedText.substring(6); // Remove ```cpp
    console.log(chalk.gray('📝 Removed ```cpp markers'));
  } else if (processedText.startsWith('```')) {
    processedText = processedText.substring(3); // Remove ```
    console.log(chalk.gray('📝 Removed ``` markers'));
  }
  if (processedText.endsWith('```')) {
    processedText = processedText.substring(0, processedText.length - 3); // Remove ```
    console.log(chalk.gray('📝 Removed trailing ``` markers'));
  }
  
  processedText = processedText.trim();

  console.log(chalk.green('✅ Raw text response processed successfully'));
  return processedText;
}