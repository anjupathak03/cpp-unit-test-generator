import { fetch as llmFetch } from './app/llm/client.js';   // adjust if you place this file elsewhere

const promptTemplate = `
C++ Unit Test Generation Request
GOALS:
    1. Achieve comprehensive test coverage for the C++ source code provided below.
    2. Specifically, ensure the generated tests cover the following missed lines:
        - ANY new line
    3. Produce valid, modern C++17 Google Test code that is well-structured and easy to understand.
    4. The tests should be self-contained and not require any external dependencies beyond the standard library and Google Test.

CONSTRAINTS:
    - Reply in strict YAML format.
    - Use only the C++17 standard library and the Google Test framework.
    - Adhere to Google's C++ Style Guide for the generated test code.
    - Do not use any mock objects unless explicitly requested.

TESTING GUIDELINES:
    - For each function or method, create a separate \`TEST\` or \`TEST_F\` block.
    - Test for a variety of input values, including:
    - Typical use cases.
    - Edge cases (e.g., empty strings, zero values, null pointers, large numbers).
    - Invalid inputs that should trigger error handling or assertions.
    - Use descriptive names for your test cases and individual tests that clearly indicate their purpose.
    - Employ a clear "Arrange, Act, Assert" pattern within each test.
    - Use appropriate Google Test matchers to make the assertions expressive (e.g., \`ASSERT_EQ\`, \`EXPECT_TRUE\`, \`ASSERT_THROW\`).
  

=== C++ Source Code to be Tested: ===
      #include <stdexcept>

namespace MathUtils {
// Adds two integers
int add(int a, int b) {
    return a + b;
}

// Subtracts b from a
int subtract(int a, int b) {
    return a - b;
}

// Multiplies two integers
int multiply(int a, int b) {
    return a * b;
}

// Divides a by b, throws exception on division by zero
double divide(int a, int b) {
    if (b == 0) {
        throw std::invalid_argument("Division by zero");
    }
    return static_cast<double>(a) / b;
}

// Calculates a raised to the power of b (b >= 0)
int power(int a, int b) {
    if (b < 0) {
        throw std::invalid_argument("Negative exponent not supported");
    }
    int result = 1;
    for (int i = 0; i < b; ++i) {
        result *= a;
    }
    return result;
}
} // namespace MathUtils
    

=== CURRENT_TEST_FILE ===
      #include <gtest/gtest.h>
 

=== TARGET_LINES ===
ALL

=== OUTPUT_SPEC ===
tests:
  - name: CamelCaseName123
    goal: |
      Short behaviour description.
    code: |
      #include <gtest/gtest.h>
      // ...
`;

(async () => {
  // Abort cleanly on Ctrl-C
  const ac = new AbortController();
  process.on('SIGINT', () => ac.abort());

  try {
    // Fetch response and save to file with timestamp
    const reply = await llmFetch(promptTemplate);

    console.log(JSON.stringify(reply, null, 2));
    
    
    // Pretty-print the formatted JSON reply
    console.log('Response received:');
    console.log(JSON.stringify(reply, null, 2));
  } catch (err) {
    console.error('❌  Fetch failed:', (err as Error).message);
    process.exit(1);
  }
})();
