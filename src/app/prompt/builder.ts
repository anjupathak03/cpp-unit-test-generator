import dedent from 'dedent';
import crypto from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020'; // Updated import
import { replySchema } from './replyschema';
import { assemble, PromptParts } from './parts.js';
import { defaultMiddleware, BuildCtx, Middleware } from './middleware.js';

const ajv = new Ajv2020(); // Updated instantiation

export const validateReply = ajv.compile(replySchema);

export interface BuildOpts {
  srcPath     : string;
  srcText     : string;
  missedLines : number[];
  prevFailures: string[];
  middlewares?: Middleware[];
  testText?   : string;
}

export function buildPrompt(opts: BuildOpts): string {
  /* 1️⃣ core parts (plain, unmodified) */

  // Determine existing test content, treating empty or whitespace-only as no file
  const existingContent = opts.testText && opts.testText.trim() !== ''
  ? opts.testText
  : 'No existing test file provided.';

  const parts: PromptParts = {
    header: dedent`
      C++ Unit Test Generation Request

    `,
    source: 
      `=== C++ Source Code to be Tested: ===
      ${opts.srcText}
    `,
    existing: `=== CURRENT_TEST_FILE ===
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
          code: |
            #include <gtest/gtest.h>
            // ...    `
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

