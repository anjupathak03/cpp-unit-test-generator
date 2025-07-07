import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { promises as fsp } from 'node:fs';

export async function tryApply(file: string, patchTxt: string, signal: AbortSignal): Promise<boolean> {
  // Save patch to tmp
  const tmp = await fsp.mkdtemp('/tmp/patch-');
  const patchPath = `${tmp}/patch.diff`;
  await fsp.writeFile(patchPath, patchTxt, 'utf8');

  const p = spawn('patch', ['-p0', file, patchPath], { signal });
  const [code] = await once(p, 'exit');
  await fsp.rm(tmp, { recursive: true, force: true });
  return code === 0;
}
