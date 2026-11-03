import type { IssueLabel } from "./labels";

export type JevRecord = {
  repo: string;
  number: number;
  label: IssueLabel;
} & (
  | {
      choice: IssueLabel;
      confidence: number;
      probabilities: Record<IssueLabel, number>;
    }
  | { error: string }
);

export interface SweepRow {
  threshold: number;
  kept: number;
  escalationRate: number;
  system1Accuracy: number;
}

const answered = (records: JevRecord[]) =>
  records.filter((r) => !("error" in r)) as Extract<
    JevRecord,
    { choice: string }
  >[];

// Errors count as escalations: in the cascade they go to System 2 too.
export function sweep(records: JevRecord[], thresholds: number[]): SweepRow[] {
  return thresholds.map((threshold) => {
    const kept = answered(records).filter((r) => r.confidence >= threshold);
    const correct = kept.filter((r) => r.choice === r.label).length;
    return {
      threshold,
      kept: kept.length,
      escalationRate: records.length ? 1 - kept.length / records.length : 0,
      system1Accuracy: kept.length ? correct / kept.length : NaN,
    };
  });
}

export function calibration(
  records: JevRecord[],
  edges = [0, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001],
) {
  const rows = answered(records);
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1]!;
    const bucket = rows.filter((r) => r.confidence >= lo && r.confidence < hi);
    const mean = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
    return {
      range: [lo, Math.min(hi, 1)] as const,
      n: bucket.length,
      meanConfidence: mean(bucket.map((r) => r.confidence)),
      accuracy: mean(bucket.map((r) => (r.choice === r.label ? 1 : 0))),
    };
  });
}

export function perLabel(records: JevRecord[], threshold: number) {
  const labels = [...new Set(records.map((r) => r.label))].sort();
  return labels.map((label) => {
    const [row] = sweep(
      records.filter((r) => r.label === label),
      [threshold],
    );
    return {
      label,
      n: records.filter((r) => r.label === label).length,
      ...row!,
    };
  });
}
