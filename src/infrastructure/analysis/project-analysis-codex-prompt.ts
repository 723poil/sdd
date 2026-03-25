export function createProjectAnalysisPrompt(input: { projectName: string }): string {
  const projectName = escapeXml(input.projectName);

  return [
    '<project_analysis_request>',
    '  <task>',
    `    <project_name>${projectName}</project_name>`,
    '    <instruction>Analyze the repository and describe the project in Korean.</instruction>',
    '    <goal>Produce a high-signal structural analysis for in-app project understanding.</goal>',
    '  </task>',
    '  <scope>',
    '    <focus>purpose</focus>',
    '    <focus>major structure</focus>',
    '    <focus>layer boundaries</focus>',
    '    <focus>key connectivity and data flow</focus>',
    '    <focus>file-level references between important files</focus>',
    '  </scope>',
    '  <constraints>',
    '    <constraint>Inspect the actual codebase.</constraint>',
    '    <constraint>Cover the whole repository enough to explain major directories, important files, and their real reference relationships.</constraint>',
    '    <constraint>Use exact relative paths that exist in the repository.</constraint>',
    '    <constraint>Do not invent files, modules, or runtime flows.</constraint>',
    '    <constraint>If something is unclear, record it in unknowns instead of guessing.</constraint>',
    '    <constraint>Prefer targeted inspection of important directories and representative files over exhaustive enumeration.</constraint>',
    '    <constraint>Keep the analysis high signal. Prefer precise structure over verbosity.</constraint>',
    '    <constraint>Write like an internal architecture note prepared by an experienced senior engineer: direct, concrete, evidence-based, and easy to skim.</constraint>',
    '    <constraint>Write every analysis document as readable Markdown.</constraint>',
    '    <constraint>Optimize for a human reader in the app. Prefer short summary paragraphs, grouped bullets, and Mermaid diagrams over raw dumps of paths.</constraint>',
    '    <constraint>The in-app Markdown renderer does not support wide tables well. Prefer headings, bullets, and Mermaid instead of large tables.</constraint>',
    '    <constraint>Each markdown document should open with a short executive summary paragraph and then use 2-4 high-signal sections.</constraint>',
    '    <constraint>Avoid repeating the same file list across multiple documents. Group evidence by responsibility, layer, or flow instead.</constraint>',
    '    <constraint>Avoid filler language, roadmap commentary, and long disclaimers. If uncertainty matters, note it once in the most relevant section.</constraint>',
    '    <constraint>Do not add a standalone "핵심 파일 참조" section inside the markdown documents. Keep file-level references in fileIndex and the reference map data only.</constraint>',
    '    <constraint>When a diagram would materially clarify structure, references, layers, sequence, or use cases, include a Mermaid fenced code block.</constraint>',
    '    <constraint>For structure, layers, and connectivity documents, include at least one Mermaid fenced code block unless the repository is too small for a meaningful diagram.</constraint>',
    '    <constraint>For file references, use only relationships justified by actual imports, requires, explicit runtime composition, or configuration wiring.</constraint>',
    '  </constraints>',
    '  <delegation>',
    '    <policy>If the repository is large or the work splits naturally, proactively delegate parallel inspection to subagents when available.</policy>',
    '    <preferred_split>top-level structure and important files</preferred_split>',
    '    <preferred_split>layer and runtime boundaries</preferred_split>',
    '    <preferred_split>connectivity and data flow</preferred_split>',
    '    <merge_requirement>Merge delegated findings into one final answer yourself.</merge_requirement>',
    '    <output_requirement>Do not mention delegation or subagents in the output.</output_requirement>',
    '  </delegation>',
    '  <output_contract>',
    '    <format>json</format>',
    '    <schema_requirement>Return JSON only and match the provided schema exactly.</schema_requirement>',
    '    <field_guidance field="detectedStack">short list of primary stack items</field_guidance>',
    '    <field_guidance field="context.files">important file paths only, not an exhaustive dump</field_guidance>',
    '    <field_guidance field="context.directories">important directory paths only, not an exhaustive dump</field_guidance>',
    '    <field_guidance field="context.modules">important modules only</field_guidance>',
    '    <field_guidance field="context.entrypoints">important entrypoints only</field_guidance>',
    '    <field_guidance field="context.keyConfigs">important config files only</field_guidance>',
    '    <field_guidance field="context.projectPurpose">1-2 sentences</field_guidance>',
    '    <field_guidance field="context.architectureSummary">concise explanation of the architecture style and boundaries</field_guidance>',
    '    <field_guidance field="context.layers">major logical layers or runtime areas with responsibilities and dependencies</field_guidance>',
    '    <field_guidance field="context.directorySummaries">key directories with their role and owning layer</field_guidance>',
    '    <field_guidance field="context.connections">the most important runtime or dependency flows between modules or layers</field_guidance>',
    '    <field_guidance field="context.documentLinks">document-map links between overview, purpose, structure, layers, and connectivity; choose labels from actual analysis meaning</field_guidance>',
    '    <field_guidance field="documents">provide five markdown documents with ids overview, purpose, structure, layers, connectivity</field_guidance>',
    '    <field_guidance field="fileIndex">important files only, each with role, category, layer, summary, and outgoing references to other indexed files</field_guidance>',
    '  </output_contract>',
    '  <document_expectations>',
    '    <document id="overview">executive summary, detected stack, entrypoints, key configs, main modules, unknowns, and a quick visual orientation if useful</document>',
    '    <document id="purpose">what the product appears to do, who or what workflow it serves, important capabilities, concrete constraints, and what still needs confirmation</document>',
    '    <document id="structure">top-level folders, major modules, responsibility split, representative directories or files, and a Mermaid structure graph</document>',
    '    <document id="layers">logical or runtime layers, dependency direction, ownership boundaries, layer-specific responsibilities, and a Mermaid dependency graph</document>',
    '    <document id="connectivity">important data flow, IPC, API, event links, cross-module relationships, key entrypoints/configs, and a Mermaid flow or sequence diagram</document>',
    '  </document_expectations>',
    '</project_analysis_request>',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function createProjectAnalysisOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['detectedStack', 'context', 'documents', 'fileIndex'],
    properties: {
      detectedStack: {
        type: 'array',
        items: { type: 'string' },
      },
      context: {
        type: 'object',
        additionalProperties: false,
        required: [
          'files',
          'directories',
          'detectedFrameworks',
          'entrypoints',
          'keyConfigs',
          'modules',
          'unknowns',
          'confidence',
          'projectPurpose',
          'architectureSummary',
          'layers',
          'directorySummaries',
          'connections',
          'documentLinks',
        ],
        properties: {
          files: { type: 'array', items: { type: 'string' } },
          directories: { type: 'array', items: { type: 'string' } },
          detectedFrameworks: { type: 'array', items: { type: 'string' } },
          entrypoints: { type: 'array', items: { type: 'string' } },
          keyConfigs: { type: 'array', items: { type: 'string' } },
          modules: { type: 'array', items: { type: 'string' } },
          unknowns: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
          projectPurpose: { type: 'string' },
          architectureSummary: { type: 'string' },
          layers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'responsibility', 'directories', 'dependsOn'],
              properties: {
                name: { type: 'string' },
                responsibility: { type: 'string' },
                directories: { type: 'array', items: { type: 'string' } },
                dependsOn: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          directorySummaries: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['path', 'role', 'layer'],
              properties: {
                path: { type: 'string' },
                role: { type: 'string' },
                layer: {
                  anyOf: [{ type: 'string' }, { type: 'null' }],
                },
              },
            },
          },
          connections: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['from', 'to', 'relationship', 'reason'],
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                relationship: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          documentLinks: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['from', 'to', 'label', 'reason'],
              properties: {
                from: {
                  type: 'string',
                  enum: ['overview', 'purpose', 'structure', 'layers', 'connectivity'],
                },
                to: {
                  type: 'string',
                  enum: ['overview', 'purpose', 'structure', 'layers', 'connectivity'],
                },
                label: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
      documents: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'summary', 'markdown'],
          properties: {
            id: {
              type: 'string',
              enum: ['overview', 'purpose', 'structure', 'layers', 'connectivity'],
            },
            summary: { type: 'string' },
            markdown: { type: 'string' },
          },
        },
      },
      fileIndex: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['path', 'role', 'layer', 'category', 'summary', 'references'],
          properties: {
            path: { type: 'string' },
            role: { type: 'string' },
            layer: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
            },
            category: { type: 'string' },
            summary: { type: 'string' },
            references: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['path', 'relationship', 'reason'],
                properties: {
                  path: { type: 'string' },
                  relationship: { type: 'string' },
                  reason: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };
}
