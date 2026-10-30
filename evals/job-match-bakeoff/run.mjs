// Runs the bake-off through promptfoo with the right env file.
//
//   node job-match-bakeoff/run.mjs [promptfoo eval flags...]
//
// Keys come from job-match-bakeoff/.env when it exists, else from
// ~/.config/jobsync-eval/.env (stays put after the worktree is gone).
// Defaults: --repeat 3, -j 2 and -o job-match-bakeoff/.data/results.json; pass
// your own --repeat, -j or -o to change them. Concurrency stays at 2 because
// OpenRouter answered 402 at 4 in-flight requests on a $10 key.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const local = path.join(here, '.env');
const shared = path.join(os.homedir(), '.config', 'jobsync-eval', '.env');
const envFile = existsSync(local) ? local : shared;
if (!existsSync(envFile)) {
  console.error(`No env file. Create ${local} or ${shared} (see .env.example).`);
  process.exit(1);
}

const args = process.argv.slice(2);
const has = (...flags) => args.some((a) => flags.includes(a));
const full = [
  'promptfoo',
  'eval',
  '--no-cache',
  '--env-file',
  envFile,
  '--config',
  path.join(here, 'promptfooconfig.yaml'),
  ...(has('--repeat') ? [] : ['--repeat', '3']),
  ...(has('-j', '--max-concurrency') ? [] : ['-j', '2']),
  ...(has('-o', '--output') ? [] : ['-o', path.join(here, '.data', 'results.json')]),
  ...args,
];

console.log(`Using keys from ${envFile}`);
const result = spawnSync('npx', full, { stdio: 'inherit', cwd: path.dirname(here) });
process.exit(result.status ?? 1);
