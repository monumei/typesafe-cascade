# Jev issue-triage eval: jev-1.14.0

2319 issues from denoland/deno, microsoft/TypeScript, microsoft/vscode, oven-sh/bun, react/react, rust-lang/rust, sveltejs/svelte, 0 errors. Stratified by label, so the mix below is not a real repo's mix.
Always answering `bug` would score 29.7% on this sample.

## Threshold sweep

| minConfidence | Jev answers | escalated | Jev accuracy on what it keeps |
| ------------- | ----------- | --------- | ----------------------------- |
| 0             | 2319        | 0.0%      | 76.7%                         |
| 0.5           | 2204        | 5.0%      | 78.6%                         |
| 0.6           | 2141        | 7.7%      | 79.5%                         |
| 0.7           | 2066        | 10.9%     | 80.6%                         |
| 0.8           | 1964        | 15.3%     | 81.9%                         |
| 0.85          | 1904        | 17.9%     | 82.8%                         |
| 0.9           | 1794        | 22.6%     | 84.3%                         |
| 0.95          | 1689        | 27.2%     | 85.2%                         |

## Per label at minConfidence 0.8

| label    | issues | escalated | Jev accuracy on what it keeps |
| -------- | ------ | --------- | ----------------------------- |
| bug      | 688    | 5.2%      | 98.2%                         |
| docs     | 422    | 15.2%     | 81.6%                         |
| feature  | 788    | 15.4%     | 87.3%                         |
| question | 421    | 31.8%     | 33.1%                         |

## Calibration

| confidence | issues | mean confidence | accuracy |
| ---------- | ------ | --------------- | -------- |
| 0–0.5      | 115    | 39.6%           | 39.1%    |
| 0.5–0.6    | 63     | 55.0%           | 49.2%    |
| 0.6–0.7    | 75     | 64.8%           | 49.3%    |
| 0.7–0.8    | 102    | 74.4%           | 54.9%    |
| 0.8–0.9    | 170    | 85.6%           | 57.1%    |
| 0.9–1      | 1794   | 98.9%           | 84.3%    |

## Calibration without `question`

`question` is the noisiest label (maintainers often relabel a bug report as a question once it's working as intended), so this checks whether the overconfidence is just that label.

| confidence | issues | mean confidence | accuracy |
| ---------- | ------ | --------------- | -------- |
| 0–0.5      | 71     | 39.4%           | 43.7%    |
| 0.5–0.6    | 40     | 55.0%           | 55.0%    |
| 0.6–0.7    | 42     | 64.8%           | 54.8%    |
| 0.7–0.8    | 68     | 74.1%           | 55.9%    |
| 0.8–0.9    | 106    | 85.9%           | 68.9%    |
| 0.9–1      | 1571   | 99.1%           | 91.7%    |
