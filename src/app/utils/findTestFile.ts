import path from 'node:path';
import { existsSync } from 'node:fs';
import fg from 'fast-glob';
import { getBaseName, CPP_TEST_EXTENSIONS } from './fileExtensions.js';

/**
 * Try hard to guess the companion test file for a C++ source file.
 *  1.  Conventional siblings   (<name>_test.cpp, test_<name>.cpp …)
 *  2.  Recursive scan in common "test" folders.
 *  3.  Final fallback: undefined (caller may create a fresh file).
 */
export async function findTestFile(
  srcFile: string,
  rootDir: string
): Promise<string | undefined> {
  const base   = getBaseName(srcFile);          // foo
  const dir    = path.dirname(srcFile);

  // Generate candidates for all test extensions
  const directCandidates: string[] = [];
  for (const ext of CPP_TEST_EXTENSIONS) {
    directCandidates.push(
      `${base}_test${ext}`,
      `test_${base}${ext}`,
      `${base}.test${ext}`,
      `${base}Test${ext}`,
    );
  }
  const fullCandidates = directCandidates.map(f => path.join(dir, f));

  for (const c of fullCandidates) if (existsSync(c)) return c;

  // ―― scan the repository (kept tiny & async with fast-glob) ----
  const globPatterns: string[] = [];
  for (const ext of CPP_TEST_EXTENSIONS) {
    globPatterns.push(
      `**/{test,tests,unittests,ut}/**/*${base}*test*${ext}`,
      `**/*${base}*test*${ext}`,
    );
  }

  const hits = await fg(globPatterns, {
    cwd      : rootDir,
    absolute : true,
    ignore   : ['**/build/**', '**/cmake-build*/**'],
  });

  return hits[0];                                 // first (best) match or undefined
}
