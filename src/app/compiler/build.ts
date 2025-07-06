import { spawn } from 'node:child_process';
import { once } from 'node:events';
import chalk from 'chalk';

export interface CompilationResult {
  success: boolean;
  errors?: string;
}

export async function compileAndRun(cfg: {
  root: string;
  testTarget: string;   // ex: "ut_bin"
}, signal: AbortSignal): Promise<CompilationResult> {
  console.log(chalk.blue('🔨 Starting compilation with error capture...'));
  console.log(chalk.gray(`📁 Working directory: ${cfg.root}`));
  console.log(chalk.gray(`🎯 Target: ${cfg.testTarget}`));

  // Build with error capture
  console.log(chalk.blue('⚙️  Running cmake build with error capture...'));
  const make = spawn('cmake', ['--build', 'build', '--target', cfg.testTarget], {
    cwd: cfg.root,
    signal,
    stdio: ['inherit', 'pipe', 'pipe'] // Capture stdout and stderr
  });

  let stdout = '';
  let stderr = '';

  make.stdout?.on('data', (data) => {
    stdout += data.toString();
  });

  make.stderr?.on('data', (data) => {
    stderr += data.toString();
  });

  const [code] = await once(make, 'exit');

  if (code !== 0) {
    console.log(chalk.red('❌ Compilation failed'));
    const errors = stderr || stdout || 'Unknown compilation error';
    return {
      success: false,
      errors
    };
  }

  console.log(chalk.green('✅ Compilation successful'));
  return {
    success: true
  };
}
