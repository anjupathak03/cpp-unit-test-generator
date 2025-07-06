import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

interface PromptCfg {
  prompt?: {
    maxSourceLines?: number;   // reserved for future
  };
  llm?: {
    model?: string;
    temperature?: number;
  };
}
export const cfg: PromptCfg = (() => {
  if (!existsSync('.utg.json')) return {};
  try {
    return JSON.parse(readFileSync('.utg.json', 'utf8'));
  } catch {
    return {};
  }
})();
