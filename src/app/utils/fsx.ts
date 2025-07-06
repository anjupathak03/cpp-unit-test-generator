import { promises as fsp } from 'node:fs';
import { existsSync } from 'node:fs';

export const fsx = {
  read: (p: string) => fsp.readFile(p, 'utf8'),
  write: (p: string, data: string) => fsp.writeFile(p, data, 'utf8'),
  readIfExists: async (p: string) => existsSync(p) ? fsp.readFile(p, 'utf8') : '',
  exists: (p: string) => existsSync(p),
};
