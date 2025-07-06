// src/app/utils/appendTest.ts
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { NewTestYaml } from '../prompt/schema.js';

/**
 * Resolve include path based on the test file location and project structure
 * @param includePath The include path from the LLM (e.g., "foo.h", "utils/bar.h", "<gtest/gtest.h>")
 * @param testFile The absolute path to the test file
 * @param srcFile The absolute path to the source file being tested
 * @returns The resolved include path
 */
async function resolveIncludePath(includePath: string, testFile: string, srcFile: string): Promise<string> {
  // Handle system includes (angle brackets) - keep as-is
  if (includePath.startsWith('<') && includePath.endsWith('>')) {
    return includePath;
  }

  // Handle quoted includes
  if (includePath.startsWith('"') && includePath.endsWith('"')) {
    const headerName = includePath.slice(1, -1);
    return await resolveRelativeIncludePath(headerName, testFile, srcFile);
  }

  // Handle bare includes (without quotes) - add quotes and resolve
  return await resolveRelativeIncludePath(includePath, testFile, srcFile);
}

/**
 * Resolve a relative include path based on the test and source file locations
 * @param headerName The header file name (e.g., "foo.h", "utils/bar.h")
 * @param testFile The absolute path to the test file
 * @param srcFile The absolute path to the source file being tested
 * @returns The resolved include path with quotes
 */
async function resolveRelativeIncludePath(headerName: string, testFile: string, srcFile: string): Promise<string> {
  const testDir = path.dirname(testFile);
  const srcDir = path.dirname(srcFile);
  
  // Strategy 1: Check if header exists relative to test file
  const testRelativePath = path.join(testDir, headerName);
  try {
    await fsp.access(testRelativePath);
    return `"${headerName}"`;
  } catch {
    // File doesn't exist, continue to next strategy
  }
  
  // Strategy 2: Check if header exists relative to source file
  const srcRelativePath = path.join(srcDir, headerName);
  try {
    await fsp.access(srcRelativePath);
    // Calculate relative path from test file to source file's header
    const relativePath = path.relative(testDir, srcRelativePath);
    return `"${relativePath}"`;
  } catch {
    // File doesn't exist, continue to next strategy
  }
  
  // Strategy 3: Check if header exists in common include directories
  const commonIncludeDirs = [
    'include',
    'src',
    'lib',
    'headers',
    'inc'
  ];
  
  for (const includeDir of commonIncludeDirs) {
    const includePath = path.join(path.dirname(testDir), includeDir, headerName);
    try {
      await fsp.access(includePath);
      const relativePath = path.relative(testDir, includePath);
      return `"${relativePath}"`;
    } catch {
      // File doesn't exist, continue to next directory
    }
  }
  
  // Strategy 4: Check if header exists in parent directories (up to 3 levels)
  let currentDir = testDir;
  for (let i = 0; i < 3; i++) {
    const parentHeaderPath = path.join(currentDir, headerName);
    try {
      await fsp.access(parentHeaderPath);
      const relativePath = path.relative(testDir, parentHeaderPath);
      return `"${relativePath}"`;
    } catch {
      // File doesn't exist, continue to parent directory
    }
    
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached root
    currentDir = parentDir;
  }
  
  // Strategy 5: If header has a directory component, try to find it in the project
  if (headerName.includes('/') || headerName.includes('\\')) {
    const headerDir = path.dirname(headerName);
    const headerBase = path.basename(headerName);
    
    // Search in common locations
    const searchDirs = [
      path.dirname(testDir), // Parent of test directory
      path.dirname(srcDir),  // Parent of source directory
      path.join(path.dirname(testDir), 'src'),
      path.join(path.dirname(testDir), 'include'),
    ];
    
    for (const searchDir of searchDirs) {
      const potentialPath = path.join(searchDir, headerName);
      try {
        await fsp.access(potentialPath);
        const relativePath = path.relative(testDir, potentialPath);
        return `"${relativePath}"`;
      } catch {
        // File doesn't exist, continue to next directory
      }
    }
  }
  
  // Fallback: return as-is with quotes (let the compiler handle it)
  return `"${headerName}"`;
}

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
  /* --------------------------------------------------------------- */
  /* 1️⃣  Read existing file (may be empty / missing)                 */
  /* --------------------------------------------------------------- */
  let existing = '';
  try {
    existing = await fsp.readFile(testFile, 'utf8');
  } catch {
    /* file does not exist → keep existing = '' */
  }

  const lines = existing.split(/\r?\n/);

  /* --------------------------------------------------------------- */
  /* 2️⃣  INCLUDE-merge with path resolution                          */
  /* --------------------------------------------------------------- */
  const incRx = /^\s*#\s*include\s+[<"].+[>"]/;
  const currentIncludes = new Set(lines.filter(l => incRx.test(l)).map(l => l.trim()));

  const normalize = async (inc: string) => {
    if (incRx.test(inc.trim())) {
      return inc.trim();
    }
    
    // Resolve the include path if we have source file context
    if (srcFile) {
      const resolvedPath = await resolveIncludePath(inc.trim(), testFile, srcFile);
      return `#include ${resolvedPath}`;
    }
    
    // Fallback: just add quotes if not already present
    const trimmed = inc.trim();
    if (!trimmed.startsWith('"') && !trimmed.startsWith('<')) {
      return `#include "${trimmed}"`;
    }
    return `#include ${trimmed}`;
  };

  const requiredIncludes = await Promise.all((newTest.includes ?? []).map(normalize));
  const missingIncludes  = requiredIncludes.filter(i => !currentIncludes.has(i));

  const lastIncIdx = lines.reduce((idx, l, i) => (incRx.test(l) ? i : idx), -1);
  if (missingIncludes.length) {
    const insertAt = lastIncIdx >= 0 ? lastIncIdx + 1 : 0;
    lines.splice(insertAt, 0, ...missingIncludes);
  }

  /* --------------------------------------------------------------- */
  /* 3️⃣  Duplicate-test check                                       */
  /* --------------------------------------------------------------- */
  const alreadyExists = new RegExp(`\\b${newTest.name}\\b`).test(existing);
  if (!alreadyExists) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(
      `// ─── AUTO-GENERATED TEST: ${newTest.name} ───`,
      newTest.code.trim(),
      '',
    );
  }

  if (!missingIncludes.length && alreadyExists) {
    return; // nothing new to add
  }

  /* --------------------------------------------------------------- */
  /* 4️⃣  Persist                                                     */
  /* --------------------------------------------------------------- */
  await fsp.mkdir(path.dirname(testFile), { recursive: true });
  await fsp.writeFile(testFile, lines.join('\n'), 'utf8');
}
