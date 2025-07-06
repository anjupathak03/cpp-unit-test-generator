#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { buildPrompt }           from './app/prompt/builder.js';
import { coverFile }         from './app/coverage/llvm.js';
import { compileAndRun }     from './app/compiler/build.js';
import { runOne }            from './app/validator/singleTest.js';
import { run as runFull }    from './app/runner.js';
import { EventBus }          from './app/events/bus.js';
import { fsx }               from './app/utils/fsx.js';
import { fetch as llmFetch } from './app/llm/client.js';

const bus = new EventBus();
bus.onAll(e => {
  if (e.type === 'info')      console.log(chalk.blue(e.msg));
  if (e.type === 'warn')      console.warn(chalk.yellow(e.msg));
  if (e.type === 'error')     console.error(chalk.red(e.msg));
  if (e.type === 'coverage')  console.log(chalk.green(`Coverage: ${e.pct.toFixed(1)} %`));
  if (e.type === 'test-result') console.log(`${e.verdict.toUpperCase()}: ${e.name}`);
});

const cli = yargs(hideBin(process.argv))
  .scriptName('gen-unit-test')
  .command('prompt',  'print a prompt for the LLM',  y => y
      .option('src', { type: 'string', demandOption: true })
      .option('root',{ type: 'string', default: '.' }),
    async argv => {
      const src = await fsx.read(argv.src);
      const prompt = buildPrompt({
        srcPath     : argv.src,
        srcText     : src,
        missedLines : [],
        prevFailures: [],
      });
      console.log(prompt)
    })

  .command('llm', 'send prompt, show raw reply', y => y
      .option('src',{ type:'string', demandOption:true })
      .option('root',{ type:'string', default:'.' }),
    async argv => {
      const src = await fsx.read(argv.src);
      const prompt = buildPrompt({ 
        srcPath     : argv.src,
        srcText     : src,
        missedLines : [],
        prevFailures: [],
      });
      const reply  = await llmFetch(prompt, new AbortController().signal);
      console.log(reply);
    })

  .command('compile', 'build & run Google-Test target', y => y
      .option('root',   { type:'string', default:'.' })
      .option('target', { type:'string', default:'ut_bin' }),
    async argv => {
      const ok = await compileAndRun({ root: argv.root, testTarget: argv.target }, new AbortController().signal);
      console.log(ok ? chalk.green('PASS') : chalk.red('FAIL'));
    })

  .command('coverage','print coverage for one file', y => y
      .option('src',  { type:'string', demandOption:true })
      .option('root', { type:'string', default:'.' }),
    async argv => {
      const snap = await coverFile({ srcFile: argv.src, root: argv.root }, new AbortController().signal);
      console.log(chalk.green(`${snap.filePct.toFixed(2)} % file, ${snap.projectPct.toFixed(2)} % project`));
      console.log('Missed lines:', snap.missedLines.slice(0,15).join(', '), '...');
    })

  .command('validate','append snippet, compile, measure', y => y
      .option('src',     { type:'string', demandOption:true })
      .option('root',    { type:'string', default:'.' })
      .option('snippet', { type:'string', demandOption:true, desc:'path to .cpp containing one TEST()' })
      .option('testFile',{ type:'string', default: a=>a.src.replace(/\.cpp$/,'_test.cpp') }),
    async argv => {
      const snippet = await fsx.read(argv.snippet);
      const base    = await coverFile({ srcFile: argv.src, root: argv.root }, new AbortController().signal);
      const res     = await runOne({
        snippet: { code: snippet, name: 'CLI' },
        cfg: { testFile: argv.testFile, srcFile: argv.src, root: argv.root, targetPct: 100 },
        coverageBase: base
      }, new AbortController().signal);
      console.log(res.verdict, res.coverage);
    })

  .command('run', 'full iterative generation (default)', y => y
      .option('src',     { type:'string', demandOption:true })
      .option('root',    { type:'string', default:'.' })
      .option('target',  { type:'number', default:80 })
      .option('maxIter', { type:'number', default:5 }),
    async argv => {
      const ac = new AbortController();
      process.on('SIGINT', () => ac.abort());
      await runFull({
        srcFile : argv.src,
        testFile: argv.src.replace(/\.cpp$/,'_test.cpp'),
        root    : argv.root,
        targetPct: argv.target,
        maxIter : argv.maxIter
      }, ac.signal, bus);
    })

  .demandCommand(1)
  .help();

await cli.parseAsync();
