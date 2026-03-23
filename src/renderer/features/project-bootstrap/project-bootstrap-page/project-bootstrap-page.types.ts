export type StatusBadgeTone = 'positive' | 'warning' | 'neutral';

export interface StatusBadgeModel {
  label: string;
  tone: StatusBadgeTone;
}

export interface AnalysisSection {
  label: string;
  values: string[];
}

export interface AnalysisPreviewModel {
  title: string;
  description: string;
  note: string;
  sections: AnalysisSection[];
}
