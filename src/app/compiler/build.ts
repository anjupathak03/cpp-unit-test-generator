import { spawn } from 'node:child_process';
import { once } from 'node:events';
import chalk from 'chalk';

export async function compileAndRun(cfg: {
  root: string;
  testTarget: string;   // ex: "ut_bin"
}, signal: AbortSignal): Promise<boolean> {

  console.log(chalk.blue('🔨 Starting compilation...'));
  console.log(chalk.gray(`📁 Working directory: ${cfg.root}`));
  console.log(chalk.gray(`🎯 Target: ${cfg.testTarget}`));

  // Configure & build only once; then ctest.
  console.log(chalk.blue('⚙️  Running cmake build...'));
  const make = spawn('cmake', ['--build', 'build', '--target', cfg.testTarget], { cwd: cfg.root, signal });
  const [code] = await once(make, 'exit');
  
  if (code !== 0) {
    console.log(chalk.red('❌ Compilation failed'));
    return false;
  }
  
  console.log(chalk.green('✅ Compilation successful'));

  console.log(chalk.blue('🧪 Running tests...'));
  const ctest = spawn('ctest', ['-R', cfg.testTarget, '--output-on-failure'], { cwd: cfg.root, signal, stdio: 'inherit' });
  const [rcode] = await once(ctest, 'exit');
  
  if (rcode === 0) {
    console.log(chalk.green('✅ All tests passed'));
  } else {
    console.log(chalk.red('❌ Some tests failed'));
  }
  
  return rcode === 0;
}
