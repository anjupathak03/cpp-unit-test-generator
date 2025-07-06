export interface PromptParts {
  header: string;
  source: string;
  existing: string;
  footer: string;
}

export function assemble(p: PromptParts): string {
  return [p.header, p.source, p.existing, p.footer]
    .filter(Boolean)
    .join('\n\n')
    .trim() + '\n';
}
