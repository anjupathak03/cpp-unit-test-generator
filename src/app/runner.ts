import { fsx } from './utils/fsx.js';
import { buildPrompt } from './prompt/builder.js';
import { fetch as llmFetch } from './llm/client.js';
import { findTestFile } from './utils/findTestFile.js';
import { applyAndValidateTests } from './utils/applyAndValidateTests.js';
import { applyAndValidateTestsWithFixing } from './utils/testFixer.js';
import { replaceWithTestExtension } from './utils/fileExtensions.js';
import chalk from 'chalk';

export interface Cfg {
  srcFile: string;
  testFile: string;
  root: string;
  bypassValidation?: boolean;
  enableAutoFix?: boolean;
  maxFixAttempts?: number;
  gpp?: boolean; // Use g++ single file mode
}

export async function run(cfg: Cfg, signal: AbortSignal) {
  console.log(chalk.blue('📖 Reading source and test files...'));
  const srcOrig = await fsx.read(cfg.srcFile);
  console.log(chalk.green(`✅ Source file read: ${cfg.srcFile}`));
  
  const testOrig = await fsx.readIfExists(cfg.testFile);
  if (testOrig) {
    console.log(chalk.green(`✅ Existing test file found: ${cfg.testFile}`));
  } else {
    console.log(chalk.yellow(`⚠️  No existing test file at: ${cfg.testFile}`));
  }

  let testPath = cfg.testFile;
  if (!testPath || !fsx.exists(testPath)) {
    console.log(chalk.blue('🔍 Searching for existing test file...'));
    testPath = await findTestFile(cfg.srcFile, cfg.root)
            ?? replaceWithTestExtension(cfg.srcFile);  // last resort
    console.log(chalk.gray(`📝 Using test file: ${testPath}`));
  }

  const testOrigContent = await fsx.readIfExists(testPath);

  console.log(chalk.blue('🔨 Building prompt for LLM...'));
  const prompt = buildPrompt({
    srcPath     : cfg.srcFile,
    srcText     : srcOrig,
    testText    : testOrigContent
  });
  console.log(chalk.green('✅ Prompt built successfully'));

  console.log(chalk.blue('🤖 Sending request to LLM...'));
  const reply = await llmFetch(prompt, signal);
  console.log(chalk.green('✅ LLM response received'));

  console.log(chalk.blue('📊 Processing LLM response...'));
  if (!reply.tests?.length) {
    console.log(chalk.yellow('⚠️  No tests generated by LLM'));
    return;
  }
  
  console.log(chalk.green(`✅ Generated ${reply.tests.length} test(s)`));
  reply.tests.forEach((test, index) => {
    console.log(chalk.gray(`  ${index + 1}. ${test.name}`));
  });

  console.log(chalk.blue('🔧 Applying and validating tests...'));
  
  // Use the enhanced version with auto-fixing if enabled
  const useAutoFix = cfg.enableAutoFix ?? true;
  const maxFixAttempts = cfg.maxFixAttempts ?? 3;
  
  const results = useAutoFix 
    ? await applyAndValidateTestsWithFixing({
        testFile: testPath,
        newTests: reply.tests,
        cfg: { ...cfg, testFile: testPath },
        signal,
        bypassValidation: cfg.bypassValidation ?? true,
        enableAutoFix: useAutoFix,
        maxFixAttempts
      })
    : await applyAndValidateTests({
        testFile: testPath,
        newTests: reply.tests,
        cfg: { ...cfg, testFile: testPath },
        signal,
        bypassValidation: cfg.bypassValidation ?? true
      });

  console.log(chalk.blue('📋 Test Results:'));
  // Log results for each test
  for (const r of results) {
    if (r.verdict === 'pass') {
      const fixedIndicator = (r as any).fixed ? ' (auto-fixed)' : '';
      console.log(chalk.green(`  ✅ ${r.name}${fixedIndicator}`));
    } else {
      console.log(chalk.red(`  ❌ ${r.name}`));
    }
  }

  const passedCount = results.filter(r => r.verdict === 'pass').length;
  const totalCount = results.length;
  
  console.log(chalk.blue('─'.repeat(50)));
  if (passedCount === totalCount) {
    console.log(chalk.green(`🎉 All ${totalCount} tests passed successfully!`));
  } else {
    console.log(chalk.yellow(`📊 Results: ${passedCount}/${totalCount} tests passed`));
  }
  console.log(chalk.blue('Test generation completed'));
  return results;
}
