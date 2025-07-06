import { appendTest } from './appendTest.js';
import { fsx } from './fsx.js';
import { runOne } from '../validator/singleTest.js';
import { NewTestYaml } from '../prompt/schema.js';
import { CoverageSnap } from '../coverage/formats.js';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

/**
 * For each test in newTests, operate on a replica of the test file, append, validate, and commit or rollback.
 * @param testFile Path to the main test file (e.g., foo_test.cpp)
 * @param newTests Array of NewTestYaml objects
 * @param cfg      Validation config (srcFile, root, targetPct, etc.)
 * @param coverageBase Initial coverage snapshot
 * @param signal   AbortSignal for cancellation
 * @returns        Array of results for each test (pass/fail)
 */
export async function applyAndValidateTests({
  testFile,
  newTests,
  cfg,
  coverageBase,
  signal
}: {
  testFile: string,
  newTests: NewTestYaml[],
  cfg: { testFile: string; srcFile: string; root: string; targetPct: number },
  coverageBase: CoverageSnap,
  signal: AbortSignal
}) {
  let results: { name: string, verdict: string }[] = [];
  let currentCoverage = coverageBase;

  for (const newTest of newTests) {
    const replicaPath = testFile + '.replica';
    // Copy the current test file to the replica
    if (fsx.exists(testFile)) {
      await fsp.copyFile(testFile, replicaPath);
    } else {
      await fsp.writeFile(replicaPath, '', 'utf8');
    }

    // Append the new test to the replica
    await appendTest(replicaPath, newTest);

    // Validate the replica
    const result = await runOne({
      snippet: { code: newTest.code, name: newTest.name },
      cfg: { ...cfg, testFile: replicaPath },
      coverageBase: currentCoverage
    }, signal);

    if (result.verdict === 'pass' || result.verdict === 'overallInc') {
      // Commit: write the replica back to the main test file
      const replicaContent = await fsx.read(replicaPath);
      await fsx.write(testFile, replicaContent);
      currentCoverage = result.coverage;
    }
    // else: rollback (do nothing, main test file remains unchanged)

    // Clean up replica
    await fsp.rm(replicaPath, { force: true });

    results.push({ name: newTest.name, verdict: result.verdict });
  }

  return results;
} 