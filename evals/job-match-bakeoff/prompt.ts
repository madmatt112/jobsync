import { JOB_MATCH_SYSTEM_PROMPT } from '../../src/lib/ai/prompts/job-match/system';

// The user prompt arrives prebuilt from export.ts (see the note there).
export default function prompt({ vars }: { vars: Record<string, string> }) {
  return [
    { role: 'system', content: JOB_MATCH_SYSTEM_PROMPT },
    { role: 'user', content: vars.user },
  ];
}
