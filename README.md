# cpp-unit-test-generator

A CLI tool to automatically generate, validate, and fix C++ unit tests using LLMs (Large Language Models) and Google Test. It streamlines the process of writing and maintaining unit tests for C++ codebases.

## Features
- **Prompt Generation**: Build prompts for LLMs based on your C++ source and existing test files.
- **LLM Integration**: Send prompts to an LLM and receive raw test suggestions.
- **Test Generation Workflow**: Automatically generate, validate, and apply unit tests for your C++ code.
- **Auto-fix**: Attempt to fix failing tests using LLM suggestions.
- **Google Test Integration**: Compile and run generated tests using Google Test.

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/cpp-unit-test-generator.git
   cd cpp-unit-test-generator
   ```
2. **Install dependencies:**
   ```sh
   npm install
   ```
3. **(Optional) Build or install Google Test** in your C++ project if not already present.

## Usage

Run the CLI using tsx (or node if compiled):
```sh
npx tsx src/cli.ts <command> [options]
```
Or add an npm script/alias for convenience.

### Main Commands

#### 1. `run` (default)
Full test generation workflow: generates, validates, and applies unit tests for a given C++ source file.

```sh
npx tsx src/cli.ts run --src <source.cpp> [--root <project-root>] [--bypassValidation] [--enableAutoFix] [--maxFixAttempts <n>]
```
- `--src` (required): Path to the C++ source file.
- `--root`: Project root directory (default: `.`).
- `--bypassValidation`: Skip validation and directly write tests (default: true).
- `--enableAutoFix`: Enable automatic test fixing (default: true).
- `--maxFixAttempts`: Maximum number of fix attempts (default: 3).

#### 2. `prompt`
Prints the LLM prompt for a given source file and (optionally) an existing test file.

```sh
npx tsx src/cli.ts prompt --src <source.cpp> [--root <project-root>] [--testFile <test.cpp>]
```

#### 3. `llm`
Sends the generated prompt to the LLM and prints the raw reply.

```sh
npx tsx src/cli.ts llm --src <source.cpp> [--root <project-root>] [--testFile <test.cpp>]
```

#### 4. `compile`
Builds and runs the Google Test target.

```sh
npx tsx src/cli.ts compile [--root <project-root>] [--testFile <test-file-path>]
```

#### 5. `fix`
Attempts to fix a failing test file using the LLM.

```sh
npx tsx src/cli.ts fix --test <test.cpp> --src <source.cpp> [--root <project-root>] [--maxAttempts <n>]
```

## Example Workflow

1. Generate and apply tests for a source file:
   ```sh
   npx tsx src/cli.ts run --src src/foo.cpp
   ```
2. If tests fail, auto-fix them:
   ```sh
   npx tsx src/cli.ts fix --test src/foo.test.cpp --src src/foo.cpp
   ```
3. Compile and run all tests:
   ```sh
   npx tsx src/cli.ts compile
   ```

## Project Structure
- `src/cli.ts` - Main CLI entry point
- `src/app/runner.ts` - Orchestrates the test generation workflow
- `src/app/prompt/` - Prompt building utilities
- `src/app/llm/` - LLM client integration
- `src/app/compiler/` - Compilation and patching helpers
- `src/app/utils/` - Utilities for file handling, test fixing, and more

## Dependencies
- [yargs](https://www.npmjs.com/package/yargs) - CLI argument parsing
- [chalk](https://www.npmjs.com/package/chalk) - Terminal string styling
- [axios](https://www.npmjs.com/package/axios) - HTTP requests
- [ollama](https://www.npmjs.com/package/ollama) - LLM API client
- [fast-glob](https://www.npmjs.com/package/fast-glob) - File globbing
- [js-yaml](https://www.npmjs.com/package/js-yaml) - YAML parsing

*This project is under active development. Contributions and feedback are welcome!* 