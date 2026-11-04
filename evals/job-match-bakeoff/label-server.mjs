// Local labelling server. Binds to 127.0.0.1 only.
//
//   node job-match-bakeoff/label-server.mjs [--port 4319] [--labels <file>]
//
// Serves label.html, the exported jobs and the resume, and writes each label
// to .data/labels.json as soon as you click. It never reads
// claude-baseline.json, so the page cannot show Claude's tier.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const dataDir = path.join(here, '.data');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const port = Number(arg('--port', '4319'));
const labelsFile = path.resolve(arg('--labels', path.join(dataDir, 'labels.json')));
const TIERS = ['strong', 'good', 'partial', 'weak'];
const DEALBREAKERS = ['none', 'location', 'management', 'other'];

const jobsFile = path.join(dataDir, 'label-jobs.json');
if (!existsSync(jobsFile)) {
  console.error('No .data/label-jobs.json. Run the export first (npm run bakeoff:export).');
  process.exit(1);
}
// Jobs marked out of scope (export --mark-scope) are not shown.
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8')).filter((j) => !j.excluded);
const resumes = JSON.parse(readFileSync(path.join(dataDir, 'resumes.json'), 'utf8'));
const jobIds = new Set(jobs.map((j) => j.jobId));

const readLabels = () =>
  existsSync(labelsFile) ? JSON.parse(readFileSync(labelsFile, 'utf8')) : {};
const writeLabels = (labels) => {
  // Write then rename, so a crash never leaves a half-written file.
  writeFileSync(`${labelsFile}.tmp`, JSON.stringify(labels, null, 2));
  renameSync(`${labelsFile}.tmp`, labelsFile);
};

const send = (res, status, type, body) => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};
const json = (res, value) => send(res, 200, 'application/json', JSON.stringify(value));

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return send(res, 200, 'text/html; charset=utf-8', readFileSync(path.join(here, 'label.html')));
  }
  if (req.method === 'GET' && req.url === '/api/data') {
    return json(res, { jobs, resumes, labels: readLabels() });
  }
  if (req.method === 'POST' && req.url === '/api/label') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        // tier: a tier, null to delete the whole label, or absent to keep it.
        // dealbreaker: { kind }, null to clear it, or absent to keep it.
        // note: the reason for the label, '' to clear it, or absent to keep it.
        const { jobId, tier, dealbreaker, note } = JSON.parse(body);
        if (!jobIds.has(jobId)) return send(res, 400, 'text/plain', 'unknown jobId');
        const labels = readLabels();
        if (tier === null) delete labels[jobId];
        else {
          if (tier !== undefined && !TIERS.includes(tier)) return send(res, 400, 'text/plain', 'bad tier');
          if (dealbreaker && !DEALBREAKERS.includes(dealbreaker.kind)) return send(res, 400, 'text/plain', 'bad dealbreaker');
          const label = { ...labels[jobId], at: new Date().toISOString() };
          if (tier !== undefined) label.tier = tier;
          if (dealbreaker === null) delete label.dealbreaker;
          else if (dealbreaker) label.dealbreaker = { kind: dealbreaker.kind };
          if (typeof note === 'string') {
            if (note.trim()) label.note = note.trim().slice(0, 500);
            else delete label.note;
          }
          // A label with a tier and no dealbreaker stores none explicitly, so a
          // blank never needs interpreting downstream.
          if (label.tier && !label.dealbreaker) label.dealbreaker = { kind: 'none' };
          labels[jobId] = label;
        }
        writeLabels(labels);
        json(res, { ok: true, count: Object.keys(labels).length });
      } catch {
        send(res, 400, 'text/plain', 'bad request');
      }
    });
    return;
  }
  send(res, 404, 'text/plain', 'not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Labelling ${jobs.length} jobs at http://127.0.0.1:${port}/`);
  console.log(`Labels save to ${labelsFile}`);
});
