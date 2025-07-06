import path from 'node:path';
import { existsSync } from 'node:fs';
import fg from 'fast-glob';

/**
 * Try hard to guess the companion *_test.cpp* for a source file.
 *  1.  Conventional siblings   (<name>_test.cpp, test_<name>.cpp …)
 *  2.  Recursive scan in common “test” folders.
 *  3.  Final fallback: undefined (caller may create a fresh file).
 */
export async function findTestFile(
  srcFile: string,
  rootDir: string
): Promise<string | undefined> {
  const base   = path.basename(srcFile, '.cpp');          // foo
  const dir    = path.dirname(srcFile);

  const directCandidates = [
    `${base}_test.cpp`,
    `test_${base}.cpp`,
    `${base}.test.cpp`,
    `${base}Test.cpp`,
  ].map(f => path.join(dir, f));

  for (const c of directCandidates) if (existsSync(c)) return c;

  // ―― scan the repository (kept tiny & async with fast-glob) ----
  const globPatterns = [
    `**/{test,tests,unittests,ut}/**/*${base}*test*.cpp`,
    `**/*${base}*test*.cpp`,
  ];

  const hits = await fg(globPatterns, {
    cwd      : rootDir,
    absolute : true,
    ignore   : ['**/build/**', '**/cmake-build*/**'],
  });

  return hits[0];                                 // first (best) match or undefined
}
