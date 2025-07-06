import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { 
  processIncludes, 
  verifyInclude, 
  getCorrespondingFile,
  generateIncludeStatement,
  normalizeIncludes,
  deduplicateIncludes 
} from './includeHandler.js';
import chalk from 'chalk';

/**
 * Test utility to demonstrate enhanced include handling
 */
export class IncludeTestUtils {
  
  /**
   * Create a test project structure for demonstrating include handling
   * @param testDir Directory to create the test project in
   */
  static async createTestProject(testDir: string): Promise<void> {
    console.log(chalk.blue('🔧 Creating test project structure...'));
    
    const projectStructure = {
      'src': {
        'math': {
          'calculator.cpp': `#include "calculator.h"
#include <iostream>

namespace Math {
  int Calculator::add(int a, int b) {
    return a + b;
  }
  
  int Calculator::subtract(int a, int b) {
    return a - b;
  }
}`,
          'calculator.h': `#pragma once
#include <string>

namespace Math {
  class Calculator {
  public:
    int add(int a, int b);
    int subtract(int a, int b);
  };
}`
        },
        'utils': {
          'string_utils.cpp': `#include "string_utils.h"
#include <algorithm>

namespace Utils {
  std::string StringUtils::toUpperCase(const std::string& str) {
    std::string result = str;
    std::transform(result.begin(), result.end(), result.begin(), ::toupper);
    return result;
  }
}`,
          'string_utils.h': `#pragma once
#include <string>

namespace Utils {
  class StringUtils {
  public:
    static std::string toUpperCase(const std::string& str);
  };
}`
        },
        'main.cpp': `#include "math/calculator.h"
#include "utils/string_utils.h"
#include <iostream>

int main() {
  Math::Calculator calc;
  std::cout << calc.add(5, 3) << std::endl;
  return 0;
}`
      },
      'include': {
        'external': {
          'third_party.h': `#pragma once
// Third party header file`
        }
      },
      'tests': {
        'math': {
          'calculator_test.cpp': `#include <gtest/gtest.h>
#include "../src/math/calculator.h"

TEST(CalculatorTest, Addition) {
  Math::Calculator calc;
  EXPECT_EQ(calc.add(2, 3), 5);
}`
        }
      }
    };
    
    await this.createDirectoryStructure(testDir, projectStructure);
    console.log(chalk.green('✅ Test project structure created'));
  }
  
  /**
   * Recursively create directory structure and files
   */
  private static async createDirectoryStructure(
    baseDir: string, 
    structure: Record<string, any>
  ): Promise<void> {
    for (const [name, content] of Object.entries(structure)) {
      const fullPath = path.join(baseDir, name);
      
      if (typeof content === 'string') {
        // It's a file
        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, content, 'utf8');
      } else {
        // It's a directory
        await fsp.mkdir(fullPath, { recursive: true });
        await this.createDirectoryStructure(fullPath, content);
      }
    }
  }
  
  /**
   * Demonstrate include verification
   * @param testDir Test project directory
   */
  static async demonstrateIncludeVerification(testDir: string): Promise<void> {
    console.log(chalk.blue('\n🔍 Demonstrating include verification...'));
    
    const testFile = path.join(testDir, 'tests/math/calculator_test.cpp');
    const srcFile = path.join(testDir, 'src/math/calculator.cpp');
    
    const testIncludes = [
      '#include <gtest/gtest.h>',
      '#include "../src/math/calculator.h"',
      '#include "nonexistent.h"',
      '#include <iostream>',
      'invalid_include',
      '#include "utils/string_utils.h"'
    ];
    
    for (const include of testIncludes) {
      const info = await verifyInclude(include, testFile, srcFile);
      const status = info.exists ? '✅' : info.isSystem ? '🔧' : '❌';
      console.log(`${status} ${include} - ${info.exists ? 'exists' : info.isSystem ? 'system' : 'not found'}`);
    }
  }
  
  /**
   * Demonstrate automatic include addition
   * @param testDir Test project directory
   */
  static async demonstrateAutoIncludeAddition(testDir: string): Promise<void> {
    console.log(chalk.blue('\n➕ Demonstrating automatic include addition...'));
    
    const testFile = path.join(testDir, 'tests/math/calculator_test.cpp');
    const srcFile = path.join(testDir, 'src/math/calculator.cpp');
    
    // Test with minimal includes
    const minimalIncludes = [
      '#include <iostream>'
    ];
    
    console.log(chalk.gray('Input includes:'));
    minimalIncludes.forEach(inc => console.log(chalk.gray(`  ${inc}`)));
    
    const result = await processIncludes(minimalIncludes, testFile, srcFile);
    
    console.log(chalk.gray('\nProcessed includes:'));
    result.includes.forEach(inc => console.log(chalk.green(`  ${inc}`)));
    
    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      result.warnings.forEach(warning => console.log(chalk.yellow(`  ${warning}`)));
    }
  }
  
  /**
   * Demonstrate corresponding file detection
   * @param testDir Test project directory
   */
  static async demonstrateCorrespondingFileDetection(testDir: string): Promise<void> {
    console.log(chalk.blue('\n🔗 Demonstrating corresponding file detection...'));
    
    const testFile = path.join(testDir, 'tests/math/calculator_test.cpp');
    
    const testFiles = [
      path.join(testDir, 'src/math/calculator.cpp'),
      path.join(testDir, 'src/math/calculator.h'),
      path.join(testDir, 'src/utils/string_utils.cpp'),
      path.join(testDir, 'src/utils/string_utils.h')
    ];
    
    for (const file of testFiles) {
      const corresponding = await getCorrespondingFile(file, testFile);
      const status = corresponding ? '✅' : '❌';
      console.log(`${status} ${path.relative(testDir, file)} -> ${corresponding ? path.relative(testDir, corresponding) : 'none'}`);
    }
  }
  
  /**
   * Demonstrate include normalization and deduplication
   */
  static demonstrateNormalizationAndDeduplication(): void {
    console.log(chalk.blue('\n🔧 Demonstrating include normalization and deduplication...'));
    
    const rawIncludes = [
      'gtest/gtest.h',
      '#include <iostream>',
      '"calculator.h"',
      '#include "calculator.h"',
      '#include <gtest/gtest.h>',
      'string_utils.h',
      '#include "calculator.h"'
    ];
    
    console.log(chalk.gray('Raw includes:'));
    rawIncludes.forEach(inc => console.log(chalk.gray(`  ${inc}`)));
    
    const normalized = normalizeIncludes(rawIncludes);
    console.log(chalk.gray('\nNormalized includes:'));
    normalized.forEach(inc => console.log(chalk.blue(`  ${inc}`)));
    
    const deduplicated = deduplicateIncludes(normalized);
    console.log(chalk.gray('\nDeduplicated includes:'));
    deduplicated.forEach(inc => console.log(chalk.green(`  ${inc}`)));
  }
  
  /**
   * Run all demonstrations
   * @param testDir Test project directory
   */
  static async runAllDemonstrations(testDir: string): Promise<void> {
    console.log(chalk.blue('🚀 Running enhanced include handling demonstrations...'));
    
    await this.demonstrateIncludeVerification(testDir);
    await this.demonstrateAutoIncludeAddition(testDir);
    await this.demonstrateCorrespondingFileDetection(testDir);
    this.demonstrateNormalizationAndDeduplication();
    
    console.log(chalk.green('\n✅ All demonstrations completed!'));
  }
} 