import dedent from 'dedent';
import { assemble, PromptParts } from './parts.js';
import { defaultMiddleware, BuildCtx, Middleware } from './middleware.js';
import path from 'node:path';
import chalk from 'chalk';

export interface BuildOpts {
  srcPath     : string;
  srcText     : string;
  middlewares?: Middleware[];
  testText?   : string;
  testPath?   : string;
  root?       : string;
}

export function buildPrompt(opts: BuildOpts): string {
  console.log(chalk.gray('  🔨 Building prompt for LLM...'));
  
  /* 1️⃣ core parts (plain, unmodified) */

  // Determine existing test content, treating empty or whitespace-only as no file
  const existingContent = opts.testText && opts.testText.trim() !== ''
  ? opts.testText
  : 'No existing test file provided.';

  if (opts.testText && opts.testText.trim() !== '') {
    console.log(chalk.gray(`  📝 Using existing test content (${opts.testText.length} characters)`));
  } else {
    console.log(chalk.gray('  📝 No existing test content provided'));
  }

  // Calculate relative paths
  const root = opts.root || '.';
  const srcRelativePath = path.relative(root, opts.srcPath);
  const testRelativePath = opts.testPath ? path.relative(root, opts.testPath) : 'No test file specified';
  
  console.log(chalk.gray(`  📁 Source path: ${srcRelativePath}`));
  console.log(chalk.gray(`  📁 Test path: ${testRelativePath}`));

  const parts: PromptParts = {
    header: dedent`
      C++ Unit Test Generation Request

    `,
    source: 
      `=== C++ Source Code to be Tested: ===
      File: ${srcRelativePath}
      ${opts.srcText}
    `,
    existing: `=== CURRENT_TEST_FILE ===
      File: ${testRelativePath}
      ${existingContent}`,
    footer: dedent`
      === OUTPUT_SPEC ===
      tests:
        - name: CamelCaseName123
          goal: |
            Short behaviour description.
          includes: |
            - <gtest/gtest.h>
            - "foo.h"
          code: |
            TEST(Foo, DoesX) { … }
    `,
  };

  console.log(chalk.gray('  📋 Assembled prompt parts'));

  /* 2️⃣ apply middleware chain */
  console.log(chalk.gray('  🔧 Applying middleware chain...'));
  const ctx: BuildCtx = {
    missed: [],
    prevFailures: []
  };
  const allMw = [...defaultMiddleware, ...(opts.middlewares || [])];
  console.log(chalk.gray(`  📝 Applying ${allMw.length} middleware(s)`));
  
  const finalParts = allMw.reduce((acc, mw) => mw(acc, ctx), parts);

  console.log(chalk.gray('  🔧 Assembling final prompt...'));
  const prompt = assemble(finalParts);
  
  console.log(chalk.gray(`  ✅ Prompt built successfully (${prompt.length} characters)`));
  return prompt;
}

