import { describe, expect, it } from "bun:test";
import { calibration, sweep, type JevRecord } from "../eval/metrics";

const p = { bug: 0, feature: 0, docs: 0, question: 0 };
const rec = (
  label: JevRecord["label"],
  choice: JevRecord["label"],
  confidence: number,
): JevRecord => ({
  repo: "r",
  number: 1,
  label,
  choice,
  confidence,
  probabilities: p,
});

const records: JevRecord[] = [
  rec("bug", "bug", 0.95),
  rec("bug", "feature", 0.9),
  rec("docs", "docs", 0.6),
  rec("question", "bug", 0.4),
  { repo: "r", number: 2, label: "bug", error: "timeout" },
];

describe("sweep", () => {
  it("keeps answers at or above the threshold and counts errors as escalations", () => {
    const [low, high] = sweep(records, [0, 0.9]);
    expect(low).toMatchObject({ kept: 4, system1Accuracy: 0.5 });
    expect(low!.escalationRate).toBeCloseTo(0.2);
    expect(high).toMatchObject({ kept: 2, system1Accuracy: 0.5 });
    expect(high!.escalationRate).toBeCloseTo(0.6);
  });

  it("reports NaN accuracy when nothing clears the threshold", () => {
    expect(sweep(records, [0.99])[0]!.system1Accuracy).toBeNaN();
  });
});

describe("calibration", () => {
  it("buckets by confidence and includes confidence 1", () => {
    const buckets = calibration([...records, rec("bug", "bug", 1)]);
    expect(buckets.map((b) => b.n)).toEqual([1, 0, 1, 0, 0, 3]);
    expect(buckets.at(-1)!.accuracy).toBeCloseTo(2 / 3);
  });
});
