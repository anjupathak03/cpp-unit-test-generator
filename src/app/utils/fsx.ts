import { promises as fsp } from 'node:fs';
import { existsSync } from 'node:fs';

export const fsx = {
  read: (p: string) => fsp.readFile(p, 'utf8'),
  write: (p: string, data: string) => fsp.writeFile(p, data, 'utf8'),
  readIfExists: async (p: string) => existsSync(p) ? fsp.readFile(p, 'utf8') : '',
  exists: (p: string) => existsSync(p),

  /**
   * Return offset line for insertion; creates cursor marker if missing.
   */
  findOrCreateCursor: async (testFile: string) => {
    const CURSOR = '// ⬅️ UTG-CURSOR\n';
    if (!existsSync(testFile)) {
      await fsp.writeFile(testFile, CURSOR);
      return CURSOR.length;
    }
    const txt = await fsp.readFile(testFile, 'utf8');
    const idx = txt.indexOf(CURSOR);
    if (idx !== -1) return idx + CURSOR.length;
    await fsp.writeFile(testFile, txt + '\n' + CURSOR);
    return (txt + '\n' + CURSOR).length;
  },

  insertAt: async (file: string, offset: number, snippet: string) => {
    const buf = await fsp.readFile(file, 'utf8');
    const out = buf.slice(0, offset) + '\n' + snippet + '\n' + buf.slice(offset);
    await fsp.writeFile(file, out, 'utf8');
  }
};
