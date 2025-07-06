export interface PromptInput {
    srcCode: string;
    uncoveredLines: number[];
    existingSigs: string;
}

export interface NewTestYaml {
    name: string;
    goal: string;
    code: string;
    extra_includes?: string;
    build_snippets?: string;
    tags?: string[];
}

export interface LlmReply {
    language: 'cpp';
    existing_test_signatures: string;
    new_tests: NewTestYaml[];
    refactor_patch?: string;
}
