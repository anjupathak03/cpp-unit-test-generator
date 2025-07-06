/* JSON-Schema v2020-12 — keep in sync with LLM OUTPUT SPEC */
export const replySchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type   : 'object',
    required: ['test_signatures', 'tests'],
    properties: {
      test_signatures: { type: 'string' },
      tests: {
        type : 'array',
        items: {
          type: 'object',
          required: ['name', 'goal', 'code'],
          properties: {
            name : { type: 'string' },
            goal : { type: 'string' },
            code : { type: 'string' },
          },
          additionalProperties: false
        }
      },
    //   refactor_patch: { type: 'string' }
    },
    additionalProperties: false
  } as const;
  