// Writes supabase/seed/questions.sql from questions.csv, for pasting into a project's SQL Editor
// (the live project has no service key on this machine). Skips questions that already exist.
//   npx tsx scripts/questions-sql.mts
import { readFileSync, writeFileSync } from "node:fs";
import { parseQuestionsCsv } from "../src/lib/questions/csv.ts";

const { questions, errors } = parseQuestionsCsv(readFileSync("supabase/seed/questions.csv", "utf8"));
if (errors.length) throw new Error(JSON.stringify(errors));

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const rows = questions.map((q) =>
  [
    lit(q.text),
    lit(q.type),
    q.options ? `${lit(JSON.stringify(q.options))}::jsonb` : "null",
    lit(q.answer),
    `array[${q.alternatives.map(lit).join(", ")}]::text[]`,
    q.difficulty,
    lit(q.topic),
    "'seed'",
  ].join(", "),
);

const sql = `-- ${questions.length} starter questions. Paste into Supabase → SQL Editor → Run. Safe to run twice.
insert into public.questions (text, type, options, answer, alternatives, difficulty, topic, source)
select * from (values
  (${rows.join("),\n  (")})
) as v(text, type, options, answer, alternatives, difficulty, topic, source)
where not exists (select 1 from public.questions q where q.text = v.text);
`;
writeFileSync("supabase/seed/questions.sql", sql);
console.log(`wrote supabase/seed/questions.sql (${questions.length} questions)`);
