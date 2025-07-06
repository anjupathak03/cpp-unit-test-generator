import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { 
  isCppSourceFile, 
  isCppHeaderFile, 
  getBaseName,
  CPP_SOURCE_EXTENSIONS,
  CPP_HEADER_EXTENSIONS 
} from './fileExtensions.js';
import chalk from 'chalk';

export interface IncludeInfo {
  path: string;
  exists: boolean;
  isSystem: boolean;
  isVerified: boolean;
}

export interface IncludeResolutionResult {
  includes: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Check if a file exists at the given path
 * @param filePath Absolute path to check
 * @returns True if file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse include statement to extract the path
 * @param includeStatement The include statement (e.g., '#include "foo.h"', '#include <iostream>')
 * @returns The extracted path or null if invalid
 */
function parseIncludePath(includeStatement: string): string | null {
  const trimmed = includeStatement.trim();
  
  // Match #include "path" or #include <path>
  const match = trimmed.match(/^\s*#\s*include\s+([<"'])([^>"']+)[>"']\s*$/);
  if (match) {
    return match[2];
  }
  
  // Match bare include without #include directive
  const bareMatch = trimmed.match(/^([<"'])([^>"']+)[>"']$/);
  if (bareMatch) {
    return bareMatch[2];
  }
  
  return null;
}

/**
 * Determine if an include is a system include (angle brackets)
 * @param includePath The include path
 * @param includeStatement The full include statement
 * @returns True if it's a system include
 */
function isSystemInclude(includePath: string, includeStatement: string): boolean {
  const trimmed = includeStatement.trim();
  return trimmed.includes(`<${includePath}>`);
}

/**
 * Find the corresponding header file for a source file
 * @param sourceFile Path to the source file
 * @returns Path to the corresponding header file or null if not found
 */
async function findCorrespondingHeader(sourceFile: string): Promise<string | null> {
  if (!isCppSourceFile(sourceFile)) {
    return null;
  }

  const baseName = getBaseName(sourceFile);
  const sourceDir = path.dirname(sourceFile);
  
  // Try to find header with same base name
  for (const headerExt of CPP_HEADER_EXTENSIONS) {
    const headerPath = path.join(sourceDir, `${baseName}${headerExt}`);
    if (await fileExists(headerPath)) {
      return headerPath;
    }
  }
  
  return null;
}

/**
 * Find the corresponding source file for a header file
 * @param headerFile Path to the header file
 * @returns Path to the corresponding source file or null if not found
 */
async function findCorrespondingSource(headerFile: string): Promise<string | null> {
  if (!isCppHeaderFile(headerFile)) {
    return null;
  }

  const baseName = getBaseName(headerFile);
  const headerDir = path.dirname(headerFile);
  
  // Try to find source with same base name
  for (const sourceExt of CPP_SOURCE_EXTENSIONS) {
    const sourcePath = path.join(headerDir, `${baseName}${sourceExt}`);
    if (await fileExists(sourcePath)) {
      return sourcePath;
    }
  }
  
  return null;
}

/**
 * Resolve include path to absolute path
 * @param includePath The include path from the statement
 * @param testFile The test file path
 * @param srcFile The source file being tested
 * @returns Array of possible absolute paths to check
 */
async function resolveIncludePaths(
  includePath: string, 
  testFile: string, 
  srcFile: string
): Promise<string[]> {
  const testDir = path.dirname(testFile);
  const srcDir = path.dirname(srcFile);
  const projectRoot = path.dirname(testDir);
  
  const candidates: string[] = [];
  
  // Strategy 1: Direct path relative to test file
  candidates.push(path.join(testDir, includePath));
  
  // Strategy 2: Path relative to source file
  candidates.push(path.join(srcDir, includePath));
  
  // Strategy 3: Common include directories
  const commonDirs = ['include', 'src', 'lib', 'headers', 'inc', 'include/cpp'];
  for (const dir of commonDirs) {
    candidates.push(path.join(projectRoot, dir, includePath));
  }
  
  // Strategy 4: Parent directories (up to 3 levels)
  let currentDir = testDir;
  for (let i = 0; i < 3; i++) {
    candidates.push(path.join(currentDir, includePath));
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  // Strategy 5: If include has directory component, search in project
  if (includePath.includes('/') || includePath.includes('\\')) {
    const searchDirs = [
      projectRoot,
      path.join(projectRoot, 'src'),
      path.join(projectRoot, 'include'),
      path.dirname(srcDir)
    ];
    
    for (const searchDir of searchDirs) {
      candidates.push(path.join(searchDir, includePath));
    }
  }
  
  return candidates;
}

/**
 * Verify if an include statement references an existing file
 * @param includeStatement The include statement to verify
 * @param testFile The test file path
 * @param srcFile The source file being tested
 * @returns IncludeInfo with verification results
 */
export async function verifyInclude(
  includeStatement: string,
  testFile: string,
  srcFile: string
): Promise<IncludeInfo> {
  const includePath = parseIncludePath(includeStatement);
  
  if (!includePath) {
    return {
      path: includeStatement,
      exists: false,
      isSystem: false,
      isVerified: false
    };
  }
  
  const isSystem = isSystemInclude(includePath, includeStatement);
  
  // For system includes, we assume they exist (compiler will handle)
  if (isSystem) {
    return {
      path: includePath,
      exists: true,
      isSystem: true,
      isVerified: true
    };
  }
  
  // For local includes, verify file existence
  const candidates = await resolveIncludePaths(includePath, testFile, srcFile);
  
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return {
        path: includePath,
        exists: true,
        isSystem: false,
        isVerified: true
      };
    }
  }
  
  return {
    path: includePath,
    exists: false,
    isSystem: false,
    isVerified: true
  };
}

/**
 * Get the corresponding header/source file for the file being tested
 * @param srcFile The source file being tested
 * @param testFile The test file path
 * @returns The corresponding file path or null
 */
export async function getCorrespondingFile(
  srcFile: string,
  testFile: string
): Promise<string | null> {
  if (isCppSourceFile(srcFile)) {
    return await findCorrespondingHeader(srcFile);
  } else if (isCppHeaderFile(srcFile)) {
    return await findCorrespondingSource(srcFile);
  }
  
  return null;
}

/**
 * Generate the include statement for a file relative to the test file
 * @param filePath The absolute path to the file to include
 * @param testFile The test file path
 * @returns The include statement
 */
export function generateIncludeStatement(filePath: string, testFile: string): string {
  const testDir = path.dirname(testFile);
  const relativePath = path.relative(testDir, filePath);
  return `#include "${relativePath}"`;
}

/**
 * Process and validate all includes for a test
 * @param includes Array of include statements from LLM
 * @param testFile The test file path
 * @param srcFile The source file being tested
 * @returns Processed includes with verification results
 */
export async function processIncludes(
  includes: string[],
  testFile: string,
  srcFile: string
): Promise<IncludeResolutionResult> {
  const result: IncludeResolutionResult = {
    includes: [],
    warnings: [],
    errors: []
  };
  
  console.log(chalk.gray('  🔍 Processing and verifying includes...'));
  
  // Verify existing includes
  for (const include of includes) {
    const info = await verifyInclude(include, testFile, srcFile);
    
    if (info.isVerified) {
      if (info.exists || info.isSystem) {
        result.includes.push(include);
        console.log(chalk.gray(`    ✅ ${include}`));
      } else {
        result.warnings.push(`Include file not found: ${info.path}`);
        console.log(chalk.yellow(`    ⚠️  ${include} (file not found)`));
      }
    } else {
      result.errors.push(`Invalid include format: ${include}`);
      console.log(chalk.red(`    ❌ ${include} (invalid format)`));
    }
  }
  
  // Add corresponding header/source file if not already included
  const correspondingFile = await getCorrespondingFile(srcFile, testFile);
  if (correspondingFile) {
    const correspondingInclude = generateIncludeStatement(correspondingFile, testFile);
    const baseName = getBaseName(correspondingFile);
    
    // Check if it's already included
    const alreadyIncluded = result.includes.some(inc => 
      inc.includes(baseName) || inc.includes(path.basename(correspondingFile))
    );
    
    if (!alreadyIncluded) {
      result.includes.push(correspondingInclude);
      console.log(chalk.blue(`    ➕ ${correspondingInclude} (auto-added)`));
    } else {
      console.log(chalk.gray(`    ✅ ${correspondingInclude} (already included)`));
    }
  }
  
  // Always include gtest if not present
  const gtestIncluded = result.includes.some(inc => 
    inc.includes('gtest/gtest.h') || inc.includes('gtest.h')
  );
  
  if (!gtestIncluded) {
    result.includes.push('#include <gtest/gtest.h>');
    console.log(chalk.blue(`    ➕ #include <gtest/gtest.h> (auto-added)`));
  }
  
  return result;
}

/**
 * Normalize include statements to standard format
 * @param includes Array of include statements
 * @returns Normalized include statements
 */
export function normalizeIncludes(includes: string[]): string[] {
  return includes.map(include => {
    const trimmed = include.trim();
    
    // If it's already a complete include statement, return as-is
    if (trimmed.startsWith('#include')) {
      return trimmed;
    }
    
    // If it has quotes or angle brackets, add #include
    if (trimmed.startsWith('"') || trimmed.startsWith('<')) {
      return `#include ${trimmed}`;
    }
    
    // Otherwise, add quotes and #include
    return `#include "${trimmed}"`;
  });
}

/**
 * Remove duplicate includes while preserving order
 * @param includes Array of include statements
 * @returns Array with duplicates removed
 */
export function deduplicateIncludes(includes: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const include of includes) {
    const normalized = include.trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  
  return result;
} 