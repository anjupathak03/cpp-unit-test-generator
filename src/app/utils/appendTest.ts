// src/app/utils/appendTest.ts
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { NewTestYaml } from '../prompt/schema.js';
import chalk from 'chalk';
import { 
  processIncludes, 
  normalizeIncludes, 
  deduplicateIncludes 
} from './includeHandler.js';

// Enhanced include handling is now in includeHandler.ts

/**
 * Append a *single* NewTestYaml block to the given test file.
 *
 * ➊ Adds any missing `#include …` directives from `newTest.includes`.  
 * ➋ Appends `newTest.code` only if a TEST with the same name isn't present.  
 * ➌ Creates the file (and parent dirs) if they don't exist.
 *
 * @param testFile Absolute/relative path to the test file.
 * @param newTest  A NewTestYaml object produced by the LLM.
 * @param srcFile  Optional: The source file being tested (for include path resolution).
 */
export async function appendTest(
  testFile: string,
  newTest: NewTestYaml,
  srcFile?: string,
): Promise<void> {
  console.log(chalk.gray(`  📝 Appending test "${newTest.name}" to ${testFile}`));
  
  /* --------------------------------------------------------------- */
  /* 1️⃣  Read existing file (may be empty / missing)                 */
  /* --------------------------------------------------------------- */
  let existing = '';
  try {
    existing = await fsp.readFile(testFile, 'utf8');
    console.log(chalk.gray(`  📖 Read existing file (${existing.length} characters)`));
  } catch {
    console.log(chalk.gray('  📖 File does not exist - will create new'));
    /* file does not exist → keep existing = '' */
  }

  const lines = existing.split(/\r?\n/);

  /* --------------------------------------------------------------- */
  /* 2️⃣  ENHANCED INCLUDE-merge with verification and auto-addition   */
  /* --------------------------------------------------------------- */
  const incRx = /^\s*#\s*include\s+[<"].+[>"]/;
  const currentIncludes = new Set(lines.filter(l => incRx.test(l)).map(l => l.trim()));

  // Process includes with enhanced verification and auto-addition
  if (srcFile) {
    const includeResult = await processIncludes(newTest.includes ?? [], testFile, srcFile);
    
    // Normalize and deduplicate the processed includes
    const normalizedIncludes = normalizeIncludes(includeResult.includes);
    const deduplicatedIncludes = deduplicateIncludes(normalizedIncludes);
    
    // Filter out includes that are already present
    const missingIncludes = deduplicatedIncludes.filter(inc => !currentIncludes.has(inc));
    
    if (missingIncludes.length > 0) {
      console.log(chalk.gray(`  📝 Adding ${missingIncludes.length} missing include(s):`));
      missingIncludes.forEach(inc => console.log(chalk.gray(`    + ${inc}`)));
    } else {
      console.log(chalk.gray('  ✅ All required includes already present'));
    }
    
    // Show warnings and errors
    if (includeResult.warnings.length > 0) {
      console.log(chalk.yellow('  ⚠️  Include warnings:'));
      includeResult.warnings.forEach(warning => console.log(chalk.yellow(`    ${warning}`)));
    }
    
    if (includeResult.errors.length > 0) {
      console.log(chalk.red('  ❌ Include errors:'));
      includeResult.errors.forEach(error => console.log(chalk.red(`    ${error}`)));
    }
    
    // Insert missing includes at the appropriate location
    const lastIncIdx = lines.reduce((idx, l, i) => (incRx.test(l) ? i : idx), -1);
    if (missingIncludes.length) {
      const insertAt = lastIncIdx >= 0 ? lastIncIdx + 1 : 0;
      lines.splice(insertAt, 0, ...missingIncludes);
    }
  } else {
    // Fallback for when srcFile is not provided
    console.log(chalk.gray('  🔍 Processing includes (fallback mode)...'));
    const normalizedIncludes = normalizeIncludes(newTest.includes ?? []);
    const deduplicatedIncludes = deduplicateIncludes(normalizedIncludes);
    const missingIncludes = deduplicatedIncludes.filter(inc => !currentIncludes.has(inc));
    
    if (missingIncludes.length > 0) {
      console.log(chalk.gray(`  📝 Adding ${missingIncludes.length} missing include(s):`));
      missingIncludes.forEach(inc => console.log(chalk.gray(`    + ${inc}`)));
    } else {
      console.log(chalk.gray('  ✅ All required includes already present'));
    }
    
    const lastIncIdx = lines.reduce((idx, l, i) => (incRx.test(l) ? i : idx), -1);
    if (missingIncludes.length) {
      const insertAt = lastIncIdx >= 0 ? lastIncIdx + 1 : 0;
      lines.splice(insertAt, 0, ...missingIncludes);
    }
  }

  /* --------------------------------------------------------------- */
  /* 3️⃣  Duplicate-test check                                       */
  /* --------------------------------------------------------------- */
  console.log(chalk.gray('  🔍 Checking for duplicate test...'));
  const alreadyExists = new RegExp(`\\b${newTest.name}\\b`).test(existing);
  if (!alreadyExists) {
    console.log(chalk.gray('  ✅ Test name is unique - will append'));
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(
      `// ─── AUTO-GENERATED TEST: ${newTest.name} ───`,
      newTest.code.trim(),
      '',
    );
  } else {
    console.log(chalk.yellow(`  ⚠️  Test "${newTest.name}" already exists - skipping`));
  }

  /* --------------------------------------------------------------- */
  /* 4️⃣  Write back                                                 */
  /* --------------------------------------------------------------- */
  if (!alreadyExists) {
    console.log(chalk.gray('  💾 Writing updated test file...'));
    await fsp.writeFile(testFile, lines.join('\n'), 'utf8');
    console.log(chalk.green(`  ✅ Test "${newTest.name}" successfully appended`));
  }
}
