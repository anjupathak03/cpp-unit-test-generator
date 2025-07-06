#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { buildPrompt }           from './app/prompt/builder.js';
import { compileAndRun }     from './app/compiler/build.js';
import { run as runFull }    from './app/runner.js';
import { fsx }               from './app/utils/fsx.js';
import { fetch as llmFetch } from './app/llm/client.js';
import { replaceWithTestExtension } from './app/utils/fileExtensions.js';

const cli = yargs(hideBin(process.argv))
  .scriptName('gen-unit-test')
  .command('prompt',  'print a prompt for the LLM',  y => y
      .option('src', { type: 'string', demandOption: true })
      .option('root',{ type: 'string', default: '.' })
      .option('testFile',{ type: 'string' }),
    async argv => {
      console.log(chalk.blue('🔍 Building prompt for LLM...'));
      console.log(chalk.gray(`📁 Source file: ${argv.src}`));
      console.log(chalk.gray(`📁 Root directory: ${argv.root}`));
      
      const src = await fsx.read(argv.src);
      console.log(chalk.green('✅ Source file read successfully'));
      
      let testFile = argv.testFile;
      if (!testFile) testFile = replaceWithTestExtension(argv.src);
      console.log(chalk.gray(`📝 Test file: ${testFile}`));
      
      const testText = await fsx.readIfExists(testFile);
      if (testText) {
        console.log(chalk.green('✅ Existing test file found'));
      } else {
        console.log(chalk.yellow('⚠️  No existing test file found'));
      }
      
      const prompt = buildPrompt({
        srcPath     : argv.src,
        srcText     : src,
        testText    : testText
      });
      
      console.log(chalk.blue('📤 Generated prompt:'));
      console.log(chalk.cyan('─'.repeat(50)));
      console.log(prompt);
      console.log(chalk.cyan('─'.repeat(50)));
    })

  .command('llm', 'send prompt, show raw reply', y => y
      .option('src',{ type:'string', demandOption:true })
      .option('root',{ type:'string', default:'.' })
      .option('testFile',{ type: 'string' }),
    async argv => {
      console.log(chalk.blue('🚀 Starting LLM request...'));
      console.log(chalk.gray(`📁 Source file: ${argv.src}`));
      console.log(chalk.gray(`📁 Root directory: ${argv.root}`));
      
      const ac = new AbortController();
      process.on('SIGINT', () => ac.abort());
      
      const src = await fsx.read(argv.src);
      console.log(chalk.green('✅ Source file read successfully'));
      
      let testFile = argv.testFile;
      if (!testFile) testFile = replaceWithTestExtension(argv.src);
      console.log(chalk.gray(`📝 Test file: ${testFile}`));
      
      const testText = await fsx.readIfExists(testFile);
      if (testText) {
        console.log(chalk.green('✅ Existing test file found'));
      } else {
        console.log(chalk.yellow('⚠️  No existing test file found'));
      }
      
      console.log(chalk.blue('🔨 Building prompt...'));
      const prompt = buildPrompt({ 
        srcPath     : argv.src,
        srcText     : src,
        testText    : testText,
        testPath    : testFile,
        root        : argv.root
      });
      console.log(chalk.green('✅ Prompt built successfully'));
      
      console.log(chalk.blue('🤖 Sending request to LLM...'));
      const reply  = await llmFetch(prompt, ac.signal);
      console.log(chalk.green('✅ LLM response received'));
      
      console.log(chalk.blue('📥 Raw LLM reply:'));
      console.log(chalk.cyan('─'.repeat(50)));
      console.log(reply);
      console.log(chalk.cyan('─'.repeat(50)));
    })

  .command('compile', 'build & run Google-Test target', y => y
      .option('root',   { type:'string', default:'.' })
      .option('testFile', { type:'string', demandOption: true }),
    async argv => {
      console.log(chalk.blue('🔨 Starting compilation and test run...'));
      console.log(chalk.gray(`📁 Root directory: ${argv.root}`));
      console.log(chalk.gray(`🎯 Test target: ${argv.testFile}`));
      
      const ac = new AbortController();
      process.on('SIGINT', () => ac.abort());
      
      console.log(chalk.blue('⚙️  Building project...'));
      const ok = await compileAndRun({ root: argv.root, testFile: argv.testFile }, ac.signal);
      
      if (ok) {
        console.log(chalk.green('🎉 PASS - All tests passed!'));
      } else {
        console.log(chalk.red('❌ FAIL - Tests failed or compilation error'));
      }
    })

  .command('run', 'full test generation (default)', y => y
      .option('src',     { type:'string', demandOption:true })
      .option('root',    { type:'string', default:'.' })
      .option('bypassValidation', { type:'boolean', default:true, desc:'Skip validation and directly write tests' })
      .option('enableAutoFix', { type:'boolean', default:true, desc:'Enable automatic test fixing when compilation fails' })
      .option('maxFixAttempts', { type:'number', default:3, desc:'Maximum number of fix attempts' })
      .option('gpp', { type:'boolean', default:false, desc:'Use g++ to build and run only the generated test file' }),
      async argv => {
      console.log(chalk.blue('🚀 Starting full test generation workflow...'));
      console.log(chalk.gray(`📁 Source file: ${argv.src}`));
      console.log(chalk.gray(`📁 Root directory: ${argv.root}`));
      console.log(chalk.gray(`⚡ Bypass validation: ${argv.bypassValidation}`));
      console.log(chalk.gray(`🔧 Auto-fix enabled: ${argv.enableAutoFix}`));
      console.log(chalk.gray(`🔄 Max fix attempts: ${argv.maxFixAttempts}`));
      console.log(chalk.gray(`🛠️  g++ single file mode: ${argv.gpp}`));
      const ac = new AbortController();
      process.on('SIGINT', () => ac.abort());
      
      await runFull({
        srcFile : argv.src,
        testFile: replaceWithTestExtension(argv.src),
        root    : argv.root,
        bypassValidation: argv.bypassValidation,
        enableAutoFix: argv.enableAutoFix,
        maxFixAttempts: argv.maxFixAttempts,
        gpp: argv.gpp
      }, ac.signal);
    })

    .command('fix', 'attempt to fix a failing test file', y => y
    .option('test',    { type:'string', demandOption:true, desc:'Path to the test file to fix' })
    .option('src',     { type:'string', demandOption:true, desc:'Path to the source file being tested' })
    .option('root',    { type:'string', default:'.', desc:'Project root directory' })
          .option('maxAttempts', { type:'number', default:3, desc:'Maximum number of fix attempts' }),
      async argv => {
      console.log(chalk.blue('🔧 Starting test file fixing...'));
      console.log(chalk.gray(`📝 Test file: ${argv.test}`));
      console.log(chalk.gray(`📝 Source file: ${argv.src}`));
      console.log(chalk.gray(`📁 Root directory: ${argv.root}`));
      console.log(chalk.gray(`🔄 Max attempts: ${argv.maxAttempts}`));
      const ac = new AbortController();
      process.on('SIGINT', () => ac.abort());
      
      const { fixTestFile } = await import('./app/utils/testFixer.js');
      
      const result = await fixTestFile({
        testFile: argv.test,
        srcFile: argv.src,
        root: argv.root,
        maxAttempts: argv.maxAttempts,
        signal: ac.signal
      });
      
      if (result.success) {
        console.log(chalk.green(`🎉 Test file fixed successfully after ${result.attempts} attempts!`));
        if (result.finalContent) {
          // Write the fixed content back to the test file
          const { fsx } = await import('./app/utils/fsx.js');
          await fsx.write(argv.test, result.finalContent);
          console.log(chalk.green(`✅ Fixed content written to ${argv.test}`));
        }
      } else {
        console.log(chalk.red(`❌ Failed to fix test file after ${result.attempts} attempts`));
        if (result.error) {
          console.log(chalk.red(`Error: ${result.error}`));
        }
      }
    })

  .demandCommand(1)
  .help();

await cli.parseAsync();
