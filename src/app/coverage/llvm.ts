import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CoverageSnap } from './formats.js';
const exec = promisify(execFile);

export async function coverFile(cfg: { srcFile: string; root: string }, signal: AbortSignal): Promise<CoverageSnap> {
  // 1. merge profraw → profdata; 2. llvm-cov export JSON
  const bin = 'llvm-cov';
  try {
    const { stdout } = await exec(bin, ['export',
      cfg.root + '/build/ut_bin',                       // your final artefact
      '-instr-profile=' + cfg.root + '/ut.profdata',
      '-format=json'],
      { signal });
    const json = JSON.parse(stdout);
    const entry = json.data[0];    // naive pick
    const lines = entry.segments.filter((s: number[]) => s[1] === cfg.srcFile);
    const covered = new Set<number>();
    const missed  = new Set<number>();
    lines.forEach(([line, , count]: number[]) => (count ? covered : missed).add(line));

    const filePct    = covered.size / (covered.size + missed.size || 1) * 100;
    const projectPct = json.totals.lines.percent;   // llvm gives this
    return { filePct, projectPct, missedLines: [...missed] };
  } catch (e) {
    throw new Error(`llvm-cov failed: ${(e as Error).message}`);
  }
}
