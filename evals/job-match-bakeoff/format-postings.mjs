// Formats each label job's description for reading on the labelling page.
//
//   node job-match-bakeoff/format-postings.mjs [--force]
//
// One deepseek-flash call per job, thinking off. The model restructures the
// text into headings, bullets and key facts; it must keep the wording and
// drop the jobscout note (its fit score would bias a blind label). The result
// goes into .data/label-jobs.json as `formatted`, with `coverage`: the share
// of the original words (jobscout note removed) that the formatted text keeps.
// The page flags a job below 0.85 and always offers the raw text.
// Only the labelling page reads `formatted`; the bake-off prompts do not.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const jobsFile = path.join(here, '.data', 'label-jobs.json');
const local = path.join(here, '.env');
const envFile = existsSync(local) ? local : path.join(os.homedir(), '.config', 'jobsync-eval', '.env');
const key = readFileSync(envFile, 'utf8').match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error(`No DEEPSEEK_API_KEY in ${envFile}.`);
  process.exit(1);
}

const SYSTEM = `You reformat a job posting so a person can read it quickly.
Rules:
- Keep the original wording. Do not summarise, shorten, paraphrase or add anything.
- Remove only the jobscout note at the start: the sentences "Found by jobscout ...", "Fit: ...", "Matched: ..." and "Honest gaps: ...". Keep everything after it.
- Put key facts (title, location, salary, hours, closing date, employment type) first as "**Label:** value" lines, one per line, using the posting's own values.
- Use "## " headings for the posting's sections, "- " for list items (turn "•" items into "- " lines), and blank lines between paragraphs.
- Output only that markdown. No code fences, no tables, no HTML.`;

const words = (s) => (s.match(/[\p{L}\p{N}$][\p{L}\p{N}$.,'/-]*/gu) ?? []).length;
const stripNote = (s) => s.replace(/Found by jobscout[\s\S]*?(?=Location: [^.]*\.\s*Posted: |Posted: \d{4}-\d{2}-\d{2})/, '');

async function format(description) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-flash',
      thinking: { type: 'disabled' },
      temperature: 0,
      max_tokens: 8000,
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: description }],
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { text: data.choices[0].message.content.trim(), usage: data.usage };
}

const force = process.argv.includes('--force');
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
const todo = jobs.filter((j) => force || !j.formatted);
let tokensIn = 0, tokensOut = 0, failed = 0;

// Four at a time; save after each job so a failure keeps the finished ones.
const queue = [...todo];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let job; (job = queue.shift()); ) {
    try {
      const { text, usage } = await format(job.description);
      tokensIn += usage?.prompt_tokens ?? 0;
      tokensOut += usage?.completion_tokens ?? 0;
      const plain = text.replace(/^#+\s|\*\*|^- /gm, '');
      job.formatted = text;
      job.coverage = Math.min(1, words(plain) / Math.max(1, words(stripNote(job.description))));
      job.noteLeft = /Found by jobscout|Honest gaps:|\(\d{1,3}\/100\)/.test(text);
      writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
      console.log(`${job.jobId}  coverage ${job.coverage.toFixed(2)}${job.noteLeft ? '  NOTE LEFT IN' : ''}`);
    } catch (e) {
      failed++;
      console.error(`${job.jobId}  failed: ${e.message}`);
    }
  }
}));

const low = jobs.filter((j) => j.formatted && (j.coverage < 0.85 || j.noteLeft)).length;
console.log(`Formatted ${todo.length - failed}/${todo.length}; ${low} flagged; ${tokensIn} in / ${tokensOut} out tokens.`);
