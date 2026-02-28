export type OptimizeRowType = 'baseline' | 'candidate';

export type OptimizeRowCommon = {
  rowType: OptimizeRowType;
  periodKey: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
};

export type OptimizeBaselineRow = OptimizeRowCommon & {
  rowType: 'baseline';
  baselineCostUsd: number | undefined;
  baselineCostIncomplete: boolean;
};

export type OptimizeCandidateRow = OptimizeRowCommon & {
  rowType: 'candidate';
  candidateModel: string;
  candidateResolvedModel: string;
  hypotheticalCostUsd: number | undefined;
  hypotheticalCostIncomplete: boolean;
  savingsUsd: number | undefined;
  savingsPct: number | undefined;
  notes?: string[];
};

export type OptimizeRow = OptimizeBaselineRow | OptimizeCandidateRow;
