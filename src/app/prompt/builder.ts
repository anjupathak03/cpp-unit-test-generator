import dedent from 'dedent';
import { assemble, PromptParts } from './parts.js';
import { defaultMiddleware, BuildCtx, Middleware } from './middleware.js';
import path from 'node:path';

export interface BuildOpts {
  srcPath     : string;
  srcText     : string;
  missedLines : number[];
  prevFailures: string[];
  middlewares?: Middleware[];
  testText?   : string;
  testPath?   : string;
  root?       : string;
}

export function buildPrompt(opts: BuildOpts): string {
  /* 1️⃣ core parts (plain, unmodified) */

  // Determine existing test content, treating empty or whitespace-only as no file
  const existingContent = opts.testText && opts.testText.trim() !== ''
  ? opts.testText
  : 'No existing test file provided.';

  // Calculate relative paths
  const root = opts.root || '.';
  const srcRelativePath = path.relative(root, opts.srcPath);
  const testRelativePath = opts.testPath ? path.relative(root, opts.testPath) : 'No test file specified';

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
    coverage: dedent`
      === TARGET_LINES ===
      ${opts.missedLines.join(' ') || 'ALL'}
    `,
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

  /* 2️⃣ apply middleware chain */
  const ctx: BuildCtx = {
    missed: opts.missedLines,
    prevFailures: opts.prevFailures
  };
  const allMw = [...defaultMiddleware, ...(opts.middlewares || [])];
  const finalParts = allMw.reduce((acc, mw) => mw(acc, ctx), parts);

  const prompt = assemble(finalParts);
  return prompt;
}

