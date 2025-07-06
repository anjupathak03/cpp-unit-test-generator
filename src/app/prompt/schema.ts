export interface NewTestYaml {
    name: string;
    goal: string;
    code: string;
    includes: string[];
}

export interface LlmReply {
    tests: NewTestYaml[];
}
