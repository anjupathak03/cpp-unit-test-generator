import { spawn } from 'node:child_process';
import { once } from 'node:events';
import chalk from 'chalk';

export interface CompilationResult {
  success: boolean;
  errors?: string;
  output?: string;
}

export async function compileAndRun(cfg: {
  root: string;
  testTarget?: string;   // ex: "ut_bin"
  testFile?: string;     // path to a single test file
  srcFile?: string;      // path to corresponding source file
  mode?: 'cmake' | 'g++'; // build mode
  gppFlags?: string[];   // extra flags for g++
}, signal: AbortSignal): Promise<CompilationResult> {
  const mode = cfg.mode || (cfg.testFile ? 'g++' : 'cmake');
  if (mode === 'g++' && cfg.testFile) {
    // --- Single file build/run with g++ ---
    const testFile = cfg.testFile;
    const outBin = `/tmp/test_bin_${Math.random().toString(36).slice(2)}`;
    const gppFlags = cfg.gppFlags || ['-std=c++17', '-lgtest_main', '-lgtest_main', '-lgtest', '-lpthread'];
    console.log(chalk.blue('🔨 Compiling single test file with g++...'));
    console.log(chalk.gray(`📄 Test file: ${testFile}`));
    
    // Build compile arguments - include source file if provided
    const compileFiles = [testFile];
    if (cfg.srcFile) {
      compileFiles.push(cfg.srcFile);
      console.log(chalk.gray(`📄 Source file: ${cfg.srcFile}`));
    }
    
    console.log(chalk.gray(`⚙️  g++ flags: ${gppFlags.join(' ')}`));
    const compileArgs = ['-o', outBin, ...compileFiles, ...gppFlags];
    console.log(chalk.gray(`🔧 Compile command: g++ ${compileArgs.join(' ')}`));
    const compile = spawn('g++', compileArgs, {
      cwd: cfg.root,
      signal,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    let compileStdout = '';
    let compileStderr = '';
    compile.stdout?.on('data', (data) => {
      compileStdout += data.toString();
    });
    compile.stderr?.on('data', (data) => {
      compileStderr += data.toString();
    });
    const [compileCode] = await once(compile, 'exit');
    if (compileCode !== 0) {
      console.log(chalk.red('❌ g++ compilation failed'));
      console.log(compileStdout ? chalk.gray(`Stdout: ${compileStdout}`) : '');
      console.log(compileStderr ? chalk.gray(`Stderr: ${compileStderr}`) : '');
      const errors = compileStderr || compileStdout || 'Unknown g++ compilation error';
      return {
        success: false,
        errors
      };
    }
    console.log(chalk.green('✅ g++ compilation successful'));
    // --- Run the binary ---
    console.log(chalk.blue('🚀 Running test binary...'));
    const run = spawn(outBin, [], {
      cwd: cfg.root,
      signal,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    let runStdout = '';
    let runStderr = '';
    run.stdout?.on('data', (data) => {
      runStdout += data.toString();
    });
    run.stderr?.on('data', (data) => {
      runStderr += data.toString();
    });
    const [runCode] = await once(run, 'exit');
    if (runCode !== 0) {
      console.log(chalk.red('❌ Test binary failed'));
      return {
        success: false,
        errors: runStderr || runStdout || 'Test binary failed',
        output: runStdout
      };
    }
    console.log(chalk.green('✅ Test binary ran successfully'));
    return {
      success: true,
      output: runStdout
    };
  } else {
    // --- CMake build (experimental) ---
    console.log(chalk.blue('🔨 Starting compilation with error capture...'));
    console.log(chalk.gray(`📁 Working directory: ${cfg.root}`));
    console.log(chalk.gray(`🎯 Target: ${cfg.testTarget}`));

    // Build with error capture
    console.log(chalk.blue('⚙️  Running cmake build with error capture...'));
    const make = spawn('cmake', ['--build', 'build', '--target', cfg.testTarget || 'ut_bin'], {
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
}
