import { compileAndRun } from '../compiler/build.js';
import { coverFile } from '../coverage/llvm.js';
import { CoverageSnap } from '../coverage/formats.js';
import { fsx } from '../utils/fsx.js';

export async function runOne(opts: {
  snippet: { code: string; name: string };
  cfg: { testFile: string; srcFile: string; root: string; targetPct: number };
  coverageBase: CoverageSnap;
}, signal: AbortSignal) {

  const offset = await fsx.findOrCreateCursor(opts.cfg.testFile);
  await fsx.insertAt(opts.cfg.testFile, offset, opts.snippet.code);

  const compiled = await compileAndRun({ root: opts.cfg.root, testTarget: 'ut_bin' }, signal);
  if (!compiled)
    return { verdict: 'fail' as const, coverage: opts.coverageBase };

  const cov = await coverFile(opts.cfg, signal);

  if (cov.filePct > opts.coverageBase.filePct)
    return { verdict: 'pass' as const, coverage: cov };
  if (cov.projectPct > opts.coverageBase.projectPct)
    return { verdict: 'overallInc' as const, coverage: cov };
  return { verdict: 'noCov' as const, coverage: cov };
}
