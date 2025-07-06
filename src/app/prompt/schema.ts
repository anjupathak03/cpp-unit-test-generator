export interface PromptInput {
    srcCode: string;
    uncoveredLines: number[];
    existingSigs: string;
}

export interface NewTestYaml {
    name: string;
    goal: string;
    code: string;
}

export interface LlmReply {
    test_signatures: string;
    tests: NewTestYaml[];
    refactor_patch?: string;
}
