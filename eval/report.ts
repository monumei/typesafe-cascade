import { model, reportPath, resultsPath } from "./labels";
import type { JevRecord } from "./metrics";
import { calibration, perLabel, sweep } from "./metrics";

const threshold = Number(process.argv[2] ?? 0.8);
const records = (await Bun.file(resultsPath).text())
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l) as JevRecord);

const pct = (x: number) => (Number.isNaN(x) ? "–" : `${(x * 100).toFixed(1)}%`);
const errors = records.filter((r) => "error" in r).length;
const bugShare =
  records.filter((r) => r.label === "bug").length / records.length;

const lines = [
  `# Jev issue-triage eval: ${model}`,
  "",
  `${records.length} issues from ${[...new Set(records.map((r) => r.repo))].join(", ")}, ${errors} errors. Stratified by label, so the mix below is not a real repo's mix.`,
  `Always answering \`bug\` would score ${pct(bugShare)} on this sample.`,
  "",
  "## Threshold sweep",
  "",
  "| minConfidence | Jev answers | escalated | Jev accuracy on what it keeps |",
  "|---|---|---|---|",
  ...sweep(records, [0, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95]).map(
    (r) =>
      `| ${r.threshold} | ${r.kept} | ${pct(r.escalationRate)} | ${pct(r.system1Accuracy)} |`,
  ),
  "",
  `## Per label at minConfidence ${threshold}`,
  "",
  "| label | issues | escalated | Jev accuracy on what it keeps |",
  "|---|---|---|---|",
  ...perLabel(records, threshold).map(
    (r) =>
      `| ${r.label} | ${r.n} | ${pct(r.escalationRate)} | ${pct(r.system1Accuracy)} |`,
  ),
  "",
  "## Calibration",
  "",
  "| confidence | issues | mean confidence | accuracy |",
  "|---|---|---|---|",
  ...calibration(records).map(
    (b) =>
      `| ${b.range[0]}–${b.range[1]} | ${b.n} | ${pct(b.meanConfidence)} | ${pct(b.accuracy)} |`,
  ),
  "",
];

await Bun.write(reportPath, lines.join("\n"));
console.log(lines.join("\n"));
