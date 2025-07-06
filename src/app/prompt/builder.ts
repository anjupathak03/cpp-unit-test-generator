import { PromptInput } from './schema.js';
export const builder = {
  build(o: {
    srcCode: string;
    uncoveredLines: number[];
    prevFailures: string[];
    cfg: { srcFile: string };
  }) {
    return `
=== ROLE ===
You are *CppTestBot*. Increase line coverage of the GIVEN file.

=== FILE: ${o.cfg.srcFile} ===
${o.srcCode}

=== MUST COVER (line numbers) ===
${o.uncoveredLines.join(' ')}

${o.prevFailures.length ? `=== PREVIOUS FAILURES ===\n${o.prevFailures.join('\n\n')}` : ''}

=== OUTPUT (YAML) ===
language: cpp
existing_test_signatures: |
  # leave empty if no tests yet
new_tests:
  - name: <CamelCase>
    goal: |
      <short description>
    code: |
      #include <gtest/gtest.h>
      // ...
    extra_includes: |
      #include <vector>
    build_snippets: |
      # optional cmake or install lines
    tags: [unit]

# Optionally include refactor_patch: |
`;
  }
};
