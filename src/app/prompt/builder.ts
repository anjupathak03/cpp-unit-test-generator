import dedent from 'dedent';
import crypto from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020'; // Updated import
import { replySchema } from './replyschema';
import { assemble, PromptParts } from './parts.js';
import { defaultMiddleware, BuildCtx, Middleware } from './middleware.js';
import { cfg as userCfg } from './config.js';

const ajv = new Ajv2020(); // Updated instantiation

export const validateReply = ajv.compile(replySchema);

export interface BuildOpts {
  srcPath     : string;
  srcText     : string;
  missedLines : number[];
  prevFailures: string[];
  middlewares?: Middleware[];
}

export function buildPrompt(opts: BuildOpts): string {
  /* 1️⃣ core parts (plain, unmodified) */
  const parts: PromptParts = {
    header: dedent`
      C++ Unit Test Generation Request

    `,
    source: 
      `=== C++ Source Code to be Tested: ===
      ${opts.srcText}
    `,
    coverage: dedent`
      === TARGET_LINES ===
      ${opts.missedLines.join(' ') || 'ALL'}
    `,
    footer: dedent`
      === OUTPUT_SPEC ===
      existing_signatures: |
        # leave blank if none
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

