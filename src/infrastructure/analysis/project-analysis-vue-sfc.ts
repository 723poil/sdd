import ts from 'typescript';

export type VueAdditionalReferenceRelationship = 'imports' | 'requires' | 'dynamic-import';

export interface VueAdditionalReference {
  relationship: VueAdditionalReferenceRelationship;
  specifier: string;
}

export interface ParsedVueSingleFileComponent {
  additionalReferences: VueAdditionalReference[];
  scriptContent: string;
  scriptKind: ts.ScriptKind;
}

export function parseVueSingleFileComponent(content: string): ParsedVueSingleFileComponent {
  const scriptContents: string[] = [];
  const additionalReferences: VueAdditionalReference[] = [];
  let scriptKind = ts.ScriptKind.JS;

  for (const match of content.matchAll(createScriptBlockPattern())) {
    const rawAttributes = match[1] ?? '';
    const scriptBody = match[2] ?? '';
    const attributes = parseHtmlAttributes(rawAttributes);
    const src = attributes.get('src');
    if (src) {
      additionalReferences.push({
        relationship: 'imports',
        specifier: src,
      });
    }

    if (scriptBody.trim().length === 0) {
      continue;
    }

    scriptContents.push(scriptBody);
    scriptKind = selectPreferredScriptKind({
      current: scriptKind,
      detected: resolveVueScriptKind(attributes.get('lang') ?? null),
    });
  }

  for (const reference of collectNonScriptModuleReferences(content.replace(createScriptBlockPattern(), ''))) {
    additionalReferences.push(reference);
  }

  return {
    additionalReferences: deduplicateAdditionalReferences(additionalReferences),
    scriptContent: scriptContents.join('\n\n'),
    scriptKind,
  };
}

function createScriptBlockPattern(): RegExp {
  return /<script\b([^>]*)>([\s\S]*?)<\/script>/giu;
}

function parseHtmlAttributes(value: string): Map<string, string> {
  const attributes = new Map<string, string>();

  for (const match of value.matchAll(/([:@\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/gu)) {
    const attributeName = match[1]?.toLowerCase();
    if (!attributeName) {
      continue;
    }

    attributes.set(attributeName, match[2] ?? match[3] ?? '');
  }

  return attributes;
}

function resolveVueScriptKind(lang: string | null): ts.ScriptKind {
  switch (lang?.trim().toLowerCase()) {
    case 'ts':
      return ts.ScriptKind.TS;
    case 'tsx':
      return ts.ScriptKind.TSX;
    case 'jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.JS;
  }
}

function selectPreferredScriptKind(input: {
  current: ts.ScriptKind;
  detected: ts.ScriptKind;
}): ts.ScriptKind {
  if (getScriptKindPriority(input.detected) > getScriptKindPriority(input.current)) {
    return input.detected;
  }

  return input.current;
}

function getScriptKindPriority(scriptKind: ts.ScriptKind): number {
  switch (scriptKind) {
    case ts.ScriptKind.TSX:
      return 4;
    case ts.ScriptKind.TS:
      return 3;
    case ts.ScriptKind.JSX:
      return 2;
    default:
      return 1;
  }
}

function collectNonScriptModuleReferences(content: string): VueAdditionalReference[] {
  const references: VueAdditionalReference[] = [];

  for (const match of content.matchAll(/\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/gu)) {
    const specifier = match[2];
    if (!specifier) {
      continue;
    }

    references.push({
      relationship: 'requires',
      specifier,
    });
  }

  for (const match of content.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/gu)) {
    const specifier = match[2];
    if (!specifier) {
      continue;
    }

    references.push({
      relationship: 'dynamic-import',
      specifier,
    });
  }

  return references;
}

function deduplicateAdditionalReferences(
  references: VueAdditionalReference[],
): VueAdditionalReference[] {
  const uniqueReferences = new Map<string, VueAdditionalReference>();

  for (const reference of references) {
    const key = `${reference.relationship}|${reference.specifier}`;
    if (uniqueReferences.has(key)) {
      continue;
    }

    uniqueReferences.set(key, reference);
  }

  return [...uniqueReferences.values()];
}
