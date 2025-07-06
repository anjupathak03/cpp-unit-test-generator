import { Ollama } from 'ollama';
import { GenerateResponse } from 'ollama/src/interfaces.js';
import { LlmReply } from '../prompt/schema.js';
import yaml from 'js-yaml';

// Initialize Ollama instance with the specific host
const ollama = new Ollama({ host: 'http://192.168.0.10:11434' });

export async function fetch(prompt: string): Promise<LlmReply> {
  const ollamaResponse = await ollama.generate({
    model: 'gemma:7b',
    prompt: prompt,
    stream: false
  }) as GenerateResponse;

  // Extract the response content from the Ollama response
  const responseText = ollamaResponse.response;
  
  console.log('LLM response:', responseText);
  if (!responseText) {
    throw new Error('No response content received from LLM');
  }

  // Remove markdown code block markers if present
  let yamlContent = responseText.trim();
  if (yamlContent.startsWith('```yaml')) {
    yamlContent = yamlContent.substring(7); // Remove ```yaml
  }
  if (yamlContent.startsWith('```')) {
    yamlContent = yamlContent.substring(3); // Remove ```
  }
  if (yamlContent.endsWith('```')) {
    yamlContent = yamlContent.substring(0, yamlContent.length - 3); // Remove ```
  }
  
  yamlContent = yamlContent.trim();

  try {
    // Parse the YAML content
    const parsed = yaml.load(yamlContent) as LlmReply;
    
    // Validate that we have the expected structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Parsed response is not an object');
    }
    
    if (!parsed.tests || !Array.isArray(parsed.tests)) {
      throw new Error('Response does not contain tests array');
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse LLM response as YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}