export type ReportReason = 'INAPPROPRIE' | 'SPAM' | 'PLAGIAT' | 'HARCELEMENT' | 'AUTRE';
export type ReportTargetType = 'DESIGN' | 'COMMENT' | 'USER';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'INAPPROPRIE', label: 'Contenu inapproprié' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'PLAGIAT', label: 'Plagiat' },
  { value: 'HARCELEMENT', label: 'Harcèlement' },
  { value: 'AUTRE', label: 'Autre' },
];
