import { EventBus } from './events/bus.js';
import { fsx } from './utils/fsx.js';
import { buildPrompt, validateReply } from './prompt/builder.js';
import { fetch as llmFetch } from './llm/client.js';
import { coverFile } from './coverage/llvm.js';
import { findTestFile } from './utils/findTestFile.js';
import { runOne } from './validator/singleTest.js';

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
      testText    : testOrig
    });

    const reply = await llmFetch(prompt, signal);
    if (!validateReply(reply)) {
      bus.emitEvent({ type:'error', msg:'❌ LLM reply schema-invalid, skipping' });
      continue;
    }
    if (!reply.tests?.length) continue;

    if (reply.refactor_patch)
      bus.emitEvent({ type: 'warn', msg: 'Patch received – apply logic TBD' });

    for (const t of reply.tests) {
      const result = await runOne({
        snippet: { code: t.code, name: t.name },
        cfg,
        coverageBase: cov
      }, signal);

      bus.emitEvent({ type: 'test-result', name: t.name, verdict: result.verdict });
      cov = result.coverage;
      bus.emitEvent({ type: 'coverage', pct: cov.filePct });
    }
  }

  if (cov.filePct <= 0) {
    await fsx.write(cfg.srcFile, srcOrig);
    if (testOrig) await fsx.write(cfg.testFile, testOrig);
    bus.emitEvent({ type: 'warn', msg: 'Rolled back — no coverage gain' });
  }

  bus.emitEvent({ type: 'info', msg: `Finished at ${cov.filePct.toFixed(1)} %` });
  return cov;
}
