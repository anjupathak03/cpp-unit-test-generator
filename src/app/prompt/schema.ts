export interface NewTestYaml {
    name: string;
    goal: string;
    code: string;
}

export interface LlmReply {
    tests: NewTestYaml[];
    refactor_patch?: string;
}
