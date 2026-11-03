import { $ } from "bun";
import { repoLabels, type Issue, type IssueLabel } from "./labels";

const perLabel = Number(process.argv[2] ?? 100);
const maxBody = 4000;
const out: Issue[] = [];

const seen = new Set<string>();
for (const [repo, mapping] of Object.entries(repoLabels)) {
  for (const ghLabel of Object.keys(mapping)) {
    const raw =
      await $`gh issue list -R ${repo} --state all --label ${ghLabel} --limit ${perLabel} --json number,title,body,labels,author`.json();
    for (const issue of raw as {
      number: number;
      title: string;
      body: string;
      labels: { name: string }[];
      author: { is_bot?: boolean; login: string };
    }[]) {
      if (issue.author?.is_bot || seen.has(`${repo}#${issue.number}`)) continue;
      seen.add(`${repo}#${issue.number}`);
      const mapped = new Set<IssueLabel>(
        issue.labels.flatMap((l) =>
          Object.hasOwn(mapping, l.name) ? [mapping[l.name]!] : [],
        ),
      );
      // Skip issues with zero or conflicting type labels: there is no single right answer to score against.
      if (mapped.size !== 1) continue;
      out.push({
        repo,
        number: issue.number,
        label: [...mapped][0]!,
        title: issue.title,
        body: (issue.body ?? "").slice(0, maxBody),
      });
    }
  }
}

await Bun.write(
  "eval/data/issues.jsonl",
  out.map((i) => JSON.stringify(i)).join("\n") + "\n",
);
const counts = Object.groupBy(out, (i) => `${i.repo} ${i.label}`);
console.log(`${out.length} issues`);
for (const [k, v] of Object.entries(counts))
  console.log(`  ${k}: ${v!.length}`);
