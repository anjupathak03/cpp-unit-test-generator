import { fetch as llmFetch, fetchRawText } from '../llm/client.js';
import { fsx } from './fsx.js';
import { compileAndRun } from '../compiler/build.js';
import { NewTestYaml } from '../prompt/schema.js';
import { appendTest } from './appendTest.js';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import dedent from 'dedent';

export interface TestFixResult {
  success: boolean;
  attempts: number;
  finalContent?: string;
  error?: string;
}

export interface TestFixConfig {
  testFile: string;
  srcFile: string;
  root: string;
  maxAttempts?: number;
  signal: AbortSignal;
}

/**
 * Attempts to fix a test file that fails compilation/testing using LLM prompts
 * @param config Configuration for test fixing
 * @returns Result of the fixing attempt
 */
export async function fixTestFile(config: TestFixConfig): Promise<TestFixResult> {
  const { testFile, srcFile, root, maxAttempts = 3, signal } = config;
  
  console.log(chalk.blue(`🔧 Starting test file fixing process...`));
  console.log(chalk.gray(`📝 Test file: ${testFile}`));
  console.log(chalk.gray(`📝 Source file: ${srcFile}`));
  console.log(chalk.gray(`🔄 Max attempts: ${maxAttempts}`));

  let currentContent = await fsx.read(testFile);
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    console.log(chalk.blue(`\n🔄 Attempt ${attempts}/${maxAttempts}`));

    // Test current content with error capture
    console.log(chalk.gray('  🔨 Testing current test file...'));
    const compilationResult = await compileAndRun({ 
      root, 
      testTarget: 'ut_bin'
    }, signal);
    
    if (compilationResult.success) {
      console.log(chalk.green(`  ✅ Test file compiles and runs successfully!`));
      return {
        success: true,
        attempts,
        finalContent: currentContent
      };
    }

    console.log(chalk.red(`  ❌ Test file failed compilation/testing`));
    if (compilationResult.errors) {
      console.log(chalk.gray(`  📋 Error details captured for LLM analysis`));
    }

    // If this is the last attempt, don't try to fix
    if (attempts >= maxAttempts) {
      console.log(chalk.red(`  🚫 Max attempts reached - giving up`));
      return {
        success: false,
        attempts,
        error: 'Max attempts reached'
      };
    }

    // Try to fix the test file using LLM
    console.log(chalk.blue(`  🤖 Attempting to fix test file using LLM...`));
    
    try {
      const fixedContent = await attemptTestFix({
        testContent: currentContent,
        srcFile,
        testFile,
        root,
        signal,
        compilationErrors: compilationResult.errors
      });

      if (fixedContent && fixedContent !== currentContent) {
        console.log(chalk.green(`  ✅ LLM generated fixed content`));
        currentContent = fixedContent;
        
        // Write the fixed content to a temporary file for testing
        const tempTestFile = testFile + '.temp';
        await fsx.write(tempTestFile, fixedContent);
        
        // Test the fixed content
        console.log(chalk.gray('  🔨 Testing fixed test file...'));
        const fixedTestResult = await compileAndRun({ 
          root, 
          testTarget: 'ut_bin'
        }, signal);
        
        if (fixedTestResult.success) {
          console.log(chalk.green(`  ✅ Fixed test file compiles and runs successfully!`));
          // Clean up temp file
          await fsp.rm(tempTestFile, { force: true });
          return {
            success: true,
            attempts,
            finalContent: fixedContent
          };
        } else {
          console.log(chalk.yellow(`  ⚠️  Fixed test file still fails, will try again`));
          // Update current content for next iteration
          currentContent = fixedContent;
        }
        
        // Clean up temp file
        await fsp.rm(tempTestFile, { force: true });
      } else {
        console.log(chalk.yellow(`  ⚠️  LLM did not generate different content`));
      }
    } catch (error) {
      console.log(chalk.red(`  ❌ Error during LLM fix attempt: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  return {
    success: false,
    attempts,
    error: 'All fix attempts failed'
  };
}

/**
 * Attempts to fix a test file using LLM by providing the current content and error context
 */
async function attemptTestFix({
  testContent,
  srcFile,
  testFile,
  root,
  signal,
  compilationErrors
}: {
  testContent: string;
  srcFile: string;
  testFile: string;
  root: string;
  signal: AbortSignal;
  compilationErrors?: string;
}): Promise<string | null> {
  const srcContent = await fsx.read(srcFile);
  const srcRelativePath = path.relative(root, srcFile);
  const testRelativePath = path.relative(root, testFile);

  const prompt = dedent`
    C++ Test File Fix Request

    The following test file is failing to compile or run. Please fix the issues and provide a corrected version.

    === SOURCE FILE ===
    File: ${srcRelativePath}
    ${srcContent}

    === CURRENT TEST FILE (WITH ERRORS) ===
    File: ${testRelativePath}
    ${testContent}

    ${compilationErrors ? `=== COMPILATION ERRORS ===
    ${compilationErrors}` : ''}

    === INSTRUCTIONS ===
    1. Analyze the compilation errors and test file for issues
    2. Fix include statements, missing dependencies, or incorrect test syntax
    3. Ensure all Google Test macros are properly formatted
    4. Verify that the test file correctly includes the source file being tested
    5. Make sure all necessary standard library includes are present
    6. Fix any namespace issues or scope problems
    7. Ensure proper test structure and assertions
    8. Pay attention to any specific error messages from the compiler

    === OUTPUT FORMAT ===
    Provide ONLY the corrected test file content without any markdown formatting or explanations.
    The output should be a complete, compilable C++ test file.

    === CORRECTED TEST FILE ===
  `;

  try {
    const correctedContent = await fetchRawText(prompt, signal);
    
    if (correctedContent && correctedContent.trim()) {
      return correctedContent;
    }
    
    console.log(chalk.yellow(`  ⚠️  LLM returned empty or invalid content`));
    return null;
  } catch (error) {
    console.log(chalk.red(`  ❌ LLM request failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    return null;
  }
}

/**
 * Enhanced version of applyAndValidateTests that includes automatic fixing
 */
export async function applyAndValidateTestsWithFixing({
  testFile,
  newTests,
  cfg,
  signal,
  bypassValidation = true,
  enableAutoFix = true,
  maxFixAttempts = 3
}: {
  testFile: string,
  newTests: NewTestYaml[],
  cfg: { testFile: string; srcFile: string; root: string },
  signal: AbortSignal,
  bypassValidation?: boolean,
  enableAutoFix?: boolean,
  maxFixAttempts?: number
}) {
  console.log(chalk.blue(`🔧 Processing ${newTests.length} test(s) with auto-fixing...`));
  console.log(chalk.gray(`📝 Test file: ${testFile}`));
  console.log(chalk.gray(`⚡ Bypass validation: ${bypassValidation}`));
  console.log(chalk.gray(`🔧 Auto-fix enabled: ${enableAutoFix}`));
  console.log(chalk.gray(`🔄 Max fix attempts: ${maxFixAttempts}`));
  
  let results: { name: string, verdict: string, fixed?: boolean }[] = [];

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
      // Use replica approach for validation with auto-fixing
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
      let compiled = await compileAndRun({ root: cfg.root, testTarget: 'ut_bin' }, signal);
      
      if (compiled) {
        // Commit: write the replica back to the main test file
        console.log(chalk.gray('  ✅ Validation passed - committing changes'));
        const replicaContent = await fsx.read(replicaPath);
        await fsx.write(testFile, replicaContent);
        console.log(chalk.green(`  ✅ Test "${newTest.name}" validated and committed`));
        results.push({ name: newTest.name, verdict: 'pass' });
      } else {
        console.log(chalk.red(`  ❌ Test "${newTest.name}" failed validation`));
        
        // Try auto-fixing if enabled
        if (enableAutoFix) {
          console.log(chalk.blue(`  🔧 Attempting to auto-fix test file...`));
          
          const fixResult = await fixTestFile({
            testFile: replicaPath,
            srcFile: cfg.srcFile,
            root: cfg.root,
            maxAttempts: maxFixAttempts,
            signal
          });
          
          if (fixResult.success && fixResult.finalContent) {
            console.log(chalk.green(`  ✅ Auto-fix successful after ${fixResult.attempts} attempts`));
            
            // Test the fixed content
            const fixedCompiled = await compileAndRun({ 
              root: cfg.root, 
              testTarget: 'ut_bin'
            }, signal);
            
            if (fixedCompiled.success) {
              // Commit the fixed content
              await fsx.write(testFile, fixResult.finalContent);
              console.log(chalk.green(`  ✅ Fixed test "${newTest.name}" committed`));
              results.push({ name: newTest.name, verdict: 'pass', fixed: true });
            } else {
              console.log(chalk.red(`  ❌ Fixed test still fails compilation`));
              results.push({ name: newTest.name, verdict: 'fail' });
            }
          } else {
            console.log(chalk.red(`  ❌ Auto-fix failed after ${fixResult.attempts} attempts`));
            results.push({ name: newTest.name, verdict: 'fail' });
          }
        } else {
          results.push({ name: newTest.name, verdict: 'fail' });
        }
      }

      // Clean up replica
      console.log(chalk.gray('  🧹 Cleaning up replica file'));
      await fsp.rm(replicaPath, { force: true });
    }
  }

  console.log(chalk.blue('\n📊 Processing complete'));
  return results;
} 