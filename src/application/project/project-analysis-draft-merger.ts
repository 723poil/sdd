import {
  PROJECT_ANALYSIS_DOCUMENT_IDS,
  type ProjectAnalysis,
  type ProjectAnalysisDraft,
} from '@/domain/project/project-analysis-model';

export function mergeReferenceAnalysisDraft(input: {
  existingAnalysis: ProjectAnalysis | null;
  referenceDraft: ProjectAnalysisDraft;
}): ProjectAnalysisDraft {
  if (!input.existingAnalysis) {
    return input.referenceDraft;
  }

  const existingAnalysis = input.existingAnalysis;
  const existingDocumentMap = new Map(
    existingAnalysis.documents.map((document) => [document.id, document] as const),
  );
  const referenceDocumentMap = new Map(
    input.referenceDraft.documents.map((document) => [document.id, document] as const),
  );
  const nextDocuments = PROJECT_ANALYSIS_DOCUMENT_IDS.flatMap((documentId) => {
    const preferredDocument =
      documentId === 'structure' || documentId === 'layers' || documentId === 'connectivity'
        ? (referenceDocumentMap.get(documentId) ?? existingDocumentMap.get(documentId))
        : (existingDocumentMap.get(documentId) ?? referenceDocumentMap.get(documentId));

    return preferredDocument ? [preferredDocument] : [];
  });
  const overviewDocument =
    nextDocuments.find((document) => document.id === 'overview') ?? nextDocuments[0] ?? null;

  return {
    detectedStack: mergeStringLists(
      input.referenceDraft.detectedStack,
      existingAnalysis.context.detectedFrameworks,
    ),
    context: {
      ...input.referenceDraft.context,
      confidence: Math.max(
        input.referenceDraft.context.confidence,
        existingAnalysis.context.confidence,
      ),
      detectedFrameworks: mergeStringLists(
        input.referenceDraft.context.detectedFrameworks,
        existingAnalysis.context.detectedFrameworks,
      ),
      documentLayouts: existingAnalysis.context.documentLayouts,
      documentLinks:
        existingAnalysis.context.documentLinks.length > 0
          ? existingAnalysis.context.documentLinks
          : input.referenceDraft.context.documentLinks,
      documentSummaries: nextDocuments.map((document) => ({
        id: document.id,
        summary: document.summary,
      })),
      entrypoints: mergeStringLists(
        input.referenceDraft.context.entrypoints,
        existingAnalysis.context.entrypoints,
      ),
      keyConfigs: mergeStringLists(
        input.referenceDraft.context.keyConfigs,
        existingAnalysis.context.keyConfigs,
      ),
      modules: mergeStringLists(
        input.referenceDraft.context.modules,
        existingAnalysis.context.modules,
      ),
      projectPurpose:
        existingAnalysis.context.projectPurpose.trim().length > 0
          ? existingAnalysis.context.projectPurpose
          : input.referenceDraft.context.projectPurpose,
      referenceAnalysis: input.referenceDraft.context.referenceAnalysis,
      unknowns: mergeStringLists(
        input.referenceDraft.context.unknowns,
        existingAnalysis.context.unknowns,
      ),
    },
    documents: nextDocuments,
    fileIndex: input.referenceDraft.fileIndex,
    summaryMarkdown: overviewDocument?.markdown ?? input.referenceDraft.summaryMarkdown,
    ...(existingAnalysis.referenceTags ? { referenceTags: existingAnalysis.referenceTags } : {}),
  };
}

function mergeStringLists(primary: string[], secondary: string[]): string[] {
  return [...new Set([...primary, ...secondary])];
}
