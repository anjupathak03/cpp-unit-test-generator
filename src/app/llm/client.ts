import axios from 'axios';
import { LlmReply } from '../prompt/schema.js';

export async function fetch(prompt: string, signal: AbortSignal): Promise<LlmReply> {
  const { data } = await axios.post('http://localhost:11434/api/generate', {
    model: 'qwen3:0.6b',
    prompt,
    stream: false
  }, { signal, timeout: 120000 });
  return JSON.parse(data.response ?? data) as LlmReply;
}
