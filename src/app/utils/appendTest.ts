// src/app/utils/appendTest.ts
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { NewTestYaml } from '../prompt/schema.js';

/**
 * Append a *single* NewTestYaml block to the given *_test.cpp* file.
 *
 * ➊ Adds any missing `#include …` directives from `newTest.includes`.  
 * ➋ Appends `newTest.code` only if a TEST with the same name isn’t present.  
 * ➌ Creates the file (and parent dirs) if they don’t exist.
 *
 * @param testFile Absolute/relative path to the *_test.cpp* file.
 * @param newTest  A NewTestYaml object produced by the LLM.
 */
export async function appendTest(
  testFile: string,
  newTest: NewTestYaml,
): Promise<void> {
  /* --------------------------------------------------------------- */
  /* 1️⃣  Read existing file (may be empty / missing)                 */
  /* --------------------------------------------------------------- */
  let existing = '';
  try {
    existing = await fsp.readFile(testFile, 'utf8');
  } catch {
    /* file does not exist → keep existing = '' */
  }

  const lines = existing.split(/\r?\n/);

  /* --------------------------------------------------------------- */
  /* 2️⃣  INCLUDE-merge                                               */
  /* --------------------------------------------------------------- */
  const incRx = /^\s*#\s*include\s+[<"].+[>"]/;
  const currentIncludes = new Set(lines.filter(l => incRx.test(l)).map(l => l.trim()));

  const normalize = (inc: string) =>
    incRx.test(inc.trim()) ? inc.trim() : `#include ${inc.trim()}`;

  const requiredIncludes = (newTest.includes ?? []).map(normalize);
  const missingIncludes  = requiredIncludes.filter(i => !currentIncludes.has(i));

  const lastIncIdx = lines.reduce((idx, l, i) => (incRx.test(l) ? i : idx), -1);
  if (missingIncludes.length) {
    const insertAt = lastIncIdx >= 0 ? lastIncIdx + 1 : 0;
    lines.splice(insertAt, 0, ...missingIncludes);
  }

  /* --------------------------------------------------------------- */
  /* 3️⃣  Duplicate-test check                                       */
  /* --------------------------------------------------------------- */
  const alreadyExists = new RegExp(`\\b${newTest.name}\\b`).test(existing);
  if (!alreadyExists) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(
      `// ─── AUTO-GENERATED TEST: ${newTest.name} ───`,
      newTest.code.trim(),
      '',
    );
  }

  if (!missingIncludes.length && alreadyExists) {
    return; // nothing new to add
  }

  /* --------------------------------------------------------------- */
  /* 4️⃣  Persist                                                     */
  /* --------------------------------------------------------------- */
  await fsp.mkdir(path.dirname(testFile), { recursive: true });
  await fsp.writeFile(testFile, lines.join('\n'), 'utf8');
}
