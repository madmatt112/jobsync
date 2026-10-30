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

const jobsFile = path.join(dataDir, 'label-jobs.json');
if (!existsSync(jobsFile)) {
  console.error('No .data/label-jobs.json. Run the export first (npm run bakeoff:export).');
  process.exit(1);
}
const jobs = JSON.parse(readFileSync(jobsFile, 'utf8'));
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
        const { jobId, tier } = JSON.parse(body);
        if (!jobIds.has(jobId)) return send(res, 400, 'text/plain', 'unknown jobId');
        const labels = readLabels();
        if (tier === null) delete labels[jobId];
        else if (TIERS.includes(tier)) labels[jobId] = { tier, at: new Date().toISOString() };
        else return send(res, 400, 'text/plain', 'bad tier');
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
