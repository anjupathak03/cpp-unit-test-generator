import path from 'node:path';

// Common C++ source file extensions
export const CPP_SOURCE_EXTENSIONS = ['.cpp', '.cc', '.cxx', '.c++', '.C'];

// Common C++ header file extensions
export const CPP_HEADER_EXTENSIONS = ['.h', '.hpp', '.hxx', '.hh'];

// Common C++ test file extensions
export const CPP_TEST_EXTENSIONS = ['.cpp', '.cc', '.cxx', '.c++', '.C'];

/**
 * Get the base name of a file without any C++ extension
 * @param filePath Path to the file
 * @returns Base name without extension
 */
export function getBaseName(filePath: string): string {
  const ext = path.extname(filePath);
  if (CPP_SOURCE_EXTENSIONS.includes(ext) || CPP_HEADER_EXTENSIONS.includes(ext)) {
    return path.basename(filePath, ext);
  }
  return path.basename(filePath, path.extname(filePath));
}

/**
 * Check if a file has a C++ source extension
 * @param filePath Path to the file
 * @returns True if the file has a C++ source extension
 */
export function isCppSourceFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return CPP_SOURCE_EXTENSIONS.includes(ext);
}

/**
 * Check if a file has a C++ header extension
 * @param filePath Path to the file
 * @returns True if the file has a C++ header extension
 */
export function isCppHeaderFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  return CPP_HEADER_EXTENSIONS.includes(ext);
}

/**
 * Check if a file has any C++ extension (source or header)
 * @param filePath Path to the file
 * @returns True if the file has any C++ extension
 */
export function isCppFile(filePath: string): boolean {
  return isCppSourceFile(filePath) || isCppHeaderFile(filePath);
}

/**
 * Generate test file name from source file name
 * @param sourceFile Path to the source file
 * @returns Test file path with appropriate extension
 */
export function generateTestFileName(sourceFile: string): string {
  const ext = path.extname(sourceFile);
  const base = getBaseName(sourceFile);
  const dir = path.dirname(sourceFile);
  return path.join(dir, `${base}_test${ext}`);
}

/**
 * Replace C++ source extension with test extension
 * @param sourceFile Path to the source file
 * @returns Test file path with appropriate extension
 */
export function replaceWithTestExtension(sourceFile: string): string {
  const ext = path.extname(sourceFile);
  const base = getBaseName(sourceFile);
  const dir = path.dirname(sourceFile);
  
  // Use the same extension as the source file for the test file
  return path.join(dir, `${base}_test${ext}`);
} 