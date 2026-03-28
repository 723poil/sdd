export function createStructuredOutputPrompt(input: {
  basePrompt: string;
  outputSchema: Record<string, unknown>;
}): string {
  return [
    input.basePrompt,
    '',
    'Additional output requirement:',
    '- Return exactly one JSON object that matches the schema below.',
    '- Do not wrap the JSON in markdown fences.',
    '- Do not add explanation before or after the JSON.',
    '',
    JSON.stringify(input.outputSchema, null, 2),
  ].join('\n');
}
