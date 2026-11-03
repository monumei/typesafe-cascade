import { createTypeSafeSystem1 } from "../src/cascade";
import { criteria, instructions, type Issue, type IssueLabel } from "./labels";
import type { JevRecord } from "./metrics";

const issuesPath = "eval/data/issues.jsonl";
const resultsPath = "eval/data/jev.jsonl";
const model = process.env.TYPESAFE_DEFAULT_MODEL ?? "jev-latest";
const concurrency = 8;
const limit = Number(process.argv[2] ?? Infinity);

const readJsonl = async <T>(path: string): Promise<T[]> => {
  const file = Bun.file(path);
  if (!(await file.exists())) return [];
  return (await file.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
};

const key = (r: { repo: string; number: number }) => `${r.repo}#${r.number}`;
const issues = await readJsonl<Issue>(issuesPath);
// Cached errors are retried; cached answers are not, so reruns never pay twice.
const prior = (await readJsonl<JevRecord>(resultsPath)).filter(
  (r) => !("error" in r),
);
const done = new Set(prior.map(key));
const todo = issues.filter((i) => !done.has(key(i))).slice(0, limit);

const system1 = createTypeSafeSystem1<IssueLabel>(undefined, model);
const records: JevRecord[] = [...prior];
let finished = 0;

async function worker(queue: Issue[]) {
  for (let issue = queue.shift(); issue; issue = queue.shift()) {
    const base = { repo: issue.repo, number: issue.number, label: issue.label };
    try {
      const r = await system1(
        { repo: issue.repo, title: issue.title, body: issue.body },
        instructions,
        criteria,
        AbortSignal.timeout(20_000),
      );
      records.push({
        ...base,
        choice: r.choice,
        confidence: r.confidence,
        probabilities: r.probabilities,
      });
    } catch (err) {
      records.push({
        ...base,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (++finished % 25 === 0) console.log(`${finished}/${todo.length}`);
  }
}

console.log(`model ${model}: ${prior.length} cached, ${todo.length} to run`);
const queue = [...todo];
await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));
await Bun.write(
  resultsPath,
  records.map((r) => JSON.stringify(r)).join("\n") + "\n",
);
console.log(
  `wrote ${records.length} records, ${records.filter((r) => "error" in r).length} errors`,
);
