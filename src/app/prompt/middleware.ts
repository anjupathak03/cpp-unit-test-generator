import type { PromptParts } from './parts.js';

/* Extend or replace in user-land */
export type Middleware = (p: PromptParts, ctx: BuildCtx) => PromptParts;
export interface BuildCtx {
  missed: number[];
  prevFailures: string[];
}

export const defaultMiddleware: Middleware[] = [
  injectGoalsConstraints,
  injectPrevFailures,
];

function injectGoalsConstraints(parts: PromptParts, ctx: BuildCtx): PromptParts {
  const goals = `
    GOALS:
      1. Achieve comprehensive test coverage for the C++ source code provided below.
      2. Specifically, ensure the generated tests cover the following missed lines:
          - ${ctx.missed.join(', ') || 'ANY new line'}
      3. Produce valid, modern C++17 Google Test code that is well-structured and easy to understand.
      4. The tests should be self-contained and not require any external dependencies beyond the standard library and Google Test.

    CONSTRAINTS:
      - Allowed content in each test file:
        • #include <gtest/gtest.h>
        • #include "<header(s)_under_test>"
        • One or more TEST(SuiteName, TestName) blocks.
        • Built-in ASSERT_/EXPECT_ macros inline.
      - DO NOT add:
        • using directives or declarations
        • helper functions, lambdas, custom matchers
        • fixtures (TEST_F), parameterised/typed tests
        • custom main(), mocks, global environments
        • any non-standard headers
      - Reply in strict YAML format as per OUTPUT spec.
      - Use only the C++17 standard library and the Google Test framework.
      - Adhere to Google's C++ Style Guide for the generated test code.
      - Do not use any mock objects unless explicitly requested.
      - Two tests name can never be same

    TESTING GUIDELINES:
      - For each function or method, create a separate \`TEST\` or \`TEST_F\` block.
      - Test for a variety of input values, including:
      - Typical use cases.
      - Edge cases (e.g., empty strings, zero values, null pointers, large numbers).
      - Invalid inputs that should trigger error handling or assertions.
      - Use descriptive names for your test cases and individual tests that clearly indicate their purpose.
      - Employ a clear "Arrange, Act, Assert" pattern within each test.
      - Use appropriate Google Test matchers to make the assertions expressive (e.g., \`ASSERT_EQ\`, \`EXPECT_TRUE\`, \`ASSERT_THROW\`).
  `;
  return { ...parts, header: parts.header + goals };
}

function injectPrevFailures(parts: PromptParts, ctx: BuildCtx): PromptParts {
  if (!ctx.prevFailures.length) return parts;
  return {
    ...parts,
    footer: parts.footer +
      '\nPREVIOUS_FAILURES:\n' +
      ctx.prevFailures.join('\n\n')
  };
}
