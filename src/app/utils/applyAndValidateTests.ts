import { appendTest } from './appendTest.js';
import { fsx } from './fsx.js';
import { compileAndRun } from '../compiler/build.js';
import { NewTestYaml } from '../prompt/schema.js';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

/**
 * For each test in newTests, append to the test file and optionally validate.
 * @param testFile Path to the main test file (e.g., foo_test.cpp, foo_test.cc, etc.)
 * @param newTests Array of NewTestYaml objects
 * @param cfg      Validation config (srcFile, root, etc.)
 * @param signal   AbortSignal for cancellation
 * @param bypassValidation If true, skip validation and directly write tests
 * @returns        Array of results for each test (pass/fail)
 */
export async function applyAndValidateTests({
  testFile,
  newTests,
  cfg,
  signal,
  bypassValidation = true
}: {
  testFile: string,
  newTests: NewTestYaml[],
  cfg: { testFile: string; srcFile: string; root: string },
  signal: AbortSignal,
  bypassValidation?: boolean
}) {
  console.log(chalk.blue(`🔧 Processing ${newTests.length} test(s)...`));
  console.log(chalk.gray(`📝 Test file: ${testFile}`));
  console.log(chalk.gray(`⚡ Bypass validation: ${bypassValidation}`));
  
  let results: { name: string, verdict: string }[] = [];

  for (let i = 0; i < newTests.length; i++) {
    const newTest = newTests[i];
    console.log(chalk.blue(`\n📝 Processing test ${i + 1}/${newTests.length}: ${newTest.name}`));
    
    if (bypassValidation) {
      // Directly append to main test file without validation
      console.log(chalk.gray('  ⚡ Bypassing validation - directly appending test'));
      await appendTest(testFile, newTest, cfg.srcFile);
      console.log(chalk.green(`  ✅ Test "${newTest.name}" appended successfully`));
      results.push({ name: newTest.name, verdict: 'pass' });
    } else {
      // Use replica approach for validation
      console.log(chalk.gray('  🔄 Using replica approach for validation'));
      const replicaPath = testFile + '.replica';
      
      // Copy the current test file to the replica
      if (fsx.exists(testFile)) {
        console.log(chalk.gray('  📋 Copying existing test file to replica'));
        await fsp.copyFile(testFile, replicaPath);
      } else {
        console.log(chalk.gray('  📋 Creating new replica file'));
        await fsp.writeFile(replicaPath, '', 'utf8');
      }

      // Append the new test to the replica
      console.log(chalk.gray('  📝 Appending test to replica'));
      await appendTest(replicaPath, newTest, cfg.srcFile);

      // Validate the replica by compiling and running
      console.log(chalk.gray('  🔨 Validating replica by compiling and running'));
      let compiled;
      if ((cfg as any).gpp) {
        compiled = await compileAndRun({ root: cfg.root, testFile: replicaPath, mode: 'g++' }, signal);
      } else {
        compiled = await compileAndRun({ root: cfg.root, testTarget: 'ut_bin' }, signal);
      }
      
      if (compiled) {
        // Commit: write the replica back to the main test file
        console.log(chalk.gray('  ✅ Validation passed - committing changes'));
        const replicaContent = await fsx.read(replicaPath);
        await fsx.write(testFile, replicaContent);
        console.log(chalk.green(`  ✅ Test "${newTest.name}" validated and committed`));
        results.push({ name: newTest.name, verdict: 'pass' });
      } else {
        console.log(chalk.red(`  ❌ Test "${newTest.name}" failed validation`));
        results.push({ name: newTest.name, verdict: 'fail' });
      }

      // Clean up replica
      console.log(chalk.gray('  🧹 Cleaning up replica file'));
      await fsp.rm(replicaPath, { force: true });
    }
  }

  console.log(chalk.blue('\n📊 Processing complete'));
  return results;
} 