import { EventBus } from './events/bus.js';
import { fsx } from './utils/fsx.js';
import { buildPrompt } from './prompt/builder.js';
import { fetch as llmFetch } from './llm/client.js';
import { coverFile } from './coverage/llvm.js';
import { findTestFile } from './utils/findTestFile.js';
import { applyAndValidateTests } from './utils/applyAndValidateTests.js';

export interface Cfg {
  srcFile: string;
  testFile: string;
  root: string;
  targetPct: number;
  maxIter: number;
}

export async function run(cfg: Cfg, signal: AbortSignal, bus = new EventBus()) {
  const srcOrig  = await fsx.read(cfg.srcFile);
  const testOrig = await fsx.readIfExists(cfg.testFile);

  let cov = await coverFile(cfg, signal);
  for (let iter = 1; iter <= cfg.maxIter && cov.filePct < cfg.targetPct; iter++) {

    let testPath = cfg.testFile;
    if (!testPath || !fsx.exists(testPath)) {
      testPath = await findTestFile(cfg.srcFile, cfg.root)
              ?? cfg.srcFile.replace(/\.cpp$/, '_test.cpp');  // last resort
    }

    const testOrig  = await fsx.readIfExists(testPath);

    const prompt = buildPrompt({
      srcPath     : cfg.srcFile,
      srcText     : srcOrig,
      missedLines : cov.missedLines,
      prevFailures: [],
      testText    : testOrig,
      testPath    : testPath,
      root        : cfg.root
    });

    const reply = await llmFetch(prompt);

    console.log(reply)
    if (!reply.tests?.length) continue;

    const results = await applyAndValidateTests({
      testFile: testPath,
      newTests: reply.tests,
      cfg: { ...cfg, testFile: testPath },
      coverageBase: cov,
      signal
    });

    // Emit events for each test result
    for (const r of results) {
      bus.emitEvent({ type: 'test-result', name: r.name, verdict: r.verdict as 'pass' | 'fail' | 'noCov' | 'overallInc' });
    }
    // Recalculate coverage after all tests
    cov = await coverFile(cfg, signal);
    bus.emitEvent({ type: 'coverage', pct: cov.filePct });
  }

  if (cov.filePct <= 0) {
    await fsx.write(cfg.srcFile, srcOrig);
    if (testOrig) await fsx.write(cfg.testFile, testOrig);
    bus.emitEvent({ type: 'warn', msg: 'Rolled back — no coverage gain' });
  }

  bus.emitEvent({ type: 'info', msg: `Finished at ${cov.filePct.toFixed(1)} %` });
  return cov;
}
