import { spawn } from 'node:child_process';
import { once } from 'node:events';

export async function compileAndRun(cfg: {
  root: string;
  testTarget: string;   // ex: "ut_bin"
}, signal: AbortSignal): Promise<boolean> {

  // Configure & build only once; then ctest.
  const make = spawn('cmake', ['--build', 'build', '--target', cfg.testTarget], { cwd: cfg.root, signal });
  const [code] = await once(make, 'exit');
  if (code !== 0) return false;

  const ctest = spawn('ctest', ['-R', cfg.testTarget, '--output-on-failure'], { cwd: cfg.root, signal, stdio: 'inherit' });
  const [rcode] = await once(ctest, 'exit');
  return rcode === 0;
}
