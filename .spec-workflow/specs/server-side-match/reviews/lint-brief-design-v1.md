# Lint brief — server-side-match design v1

## Job
Fix the lint findings below in v1 of `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/design.md` in place.

## Inputs
- Context file: `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/design.md` (v1). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one.
- Requirements: `/home/mcf/repo/jobsync/.spec-workflow/specs/server-side-match/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: a version's lint pass receives the prior version's dispositioned findings (each token, its disposition and reason).

## Revision input
L-1 (warning, citation-identifier, line 15): Identifier 'Label' is absent from the cited ranges (src/components/ui/switch.tsx:8-29)
L-2 (warning, citation-identifier, line 15): Identifier 'Select' is absent from the cited ranges (src/components/ui/switch.tsx:8-29)
L-3 (warning, citation-identifier, line 46): Identifier 'deepseek' is absent from the cited ranges (node_modules/ai/dist/index.d.ts:1390)
L-4 (warning, citation-identifier, line 46): Identifier 'generateText' is absent from the cited ranges (node_modules/ai/dist/index.d.ts:1390)
L-5 (error, citation-path, line 46): Cited path resolves under no base (code root, spec store, spec dir): ai-sdk/deepseek/dist/index.js
L-6 (error, citation-path, line 46): Cited path resolves under no base (code root, spec store, spec dir): ai-sdk/deepseek/dist/index.js
L-7 (error, citation-path, line 46): Cited path resolves under no base (code root, spec store, spec dir): ai-sdk/deepseek/dist/index.js
L-8 (error, citation-path, line 46): Cited path resolves under no base (code root, spec store, spec dir): ai-sdk/deepseek/dist/index.js
L-9 (warning, citation-identifier, line 50): Identifier 'getDefaultModelForProvider' is absent from the cited ranges (src/models/ai.model.ts:37-40, src/lib/scraper/automation-run/aiSettings.ts:32-33)
L-10 (warning, citation-identifier, line 50): Identifier 'DEEPSEEK_FLASH' is absent from the cited ranges (src/models/ai.model.ts:37-40, src/lib/scraper/automation-run/aiSettings.ts:32-33)
L-11 (warning, citation-identifier, line 56): Identifier 'defaultUserSettings' is absent from the cited ranges (src/models/userSettings.model.ts:3-6)
L-12 (warning, citation-identifier, line 61): Identifier 'Switch' is absent from the cited ranges (src/app/dashboard/settings/page.tsx:25, __tests__/AiSettings.spec.tsx:6-9)
L-13 (warning, citation-identifier, line 61): Identifier 'updateServerSideMatch' is absent from the cited ranges (src/app/dashboard/settings/page.tsx:25, __tests__/AiSettings.spec.tsx:6-9)
L-14 (warning, citation-identifier, line 61): Identifier 'toastError' is absent from the cited ranges (src/app/dashboard/settings/page.tsx:25, __tests__/AiSettings.spec.tsx:6-9)
L-15 (warning, citation-identifier, line 80): Identifier 'MatchReply' is absent from the cited ranges (src/lib/mcp/tools/matchDirective.ts:144-151)
L-16 (warning, citation-identifier, line 86): Identifier 'handleAddJob' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:38-46, src/lib/jobs/createJobFromNames.ts:58-75)
L-17 (warning, citation-identifier, line 86): Identifier 'createJobFromNames' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:38-46, src/lib/jobs/createJobFromNames.ts:58-75)
L-18 (warning, citation-identifier, line 87): Identifier 'skipMatch' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:57-78)
L-19 (warning, citation-identifier, line 88): Identifier 'handleUpdateJob' is absent from the cited ranges (src/lib/mcp/tools/updateJob.ts:29-37)
L-20 (warning, citation-identifier, line 88): Identifier 'update_job' is absent from the cited ranges (src/lib/mcp/tools/updateJob.ts:29-37)
L-21 (warning, citation-identifier, line 88): Identifier 'skipMatch' is absent from the cited ranges (src/lib/mcp/tools/updateJob.ts:29-37)
L-22 (warning, citation-identifier, line 89): Identifier 'handleGetJob' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:27-36)
L-23 (warning, citation-identifier, line 89): Identifier 'matchDirective' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:27-36)
L-24 (warning, citation-identifier, line 89): Identifier 'handleAddJobsBatch' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:27-36)
L-25 (warning, citation-identifier, line 89): Identifier 'handleAddJob' is absent from the cited ranges (src/lib/mcp/tools/addJob.ts:27-36)
L-26 (warning, citation-identifier, line 97): Identifier 'no_resumes' is absent from the cited ranges (src/lib/mcp/tools/matchDirective.ts:95-97)
L-27 (warning, citation-identifier, line 97): Identifier 'needs_selection' is absent from the cited ranges (src/lib/mcp/tools/matchDirective.ts:95-97)
L-28 (warning, citation-identifier, line 105): Identifier 'user_id' is absent from the cited ranges (src/lib/telemetry/genai.ts:7-14, src/actions/automation/analyze.ts:100)
L-29 (warning, citation-identifier, line 105): Identifier 'job_id' is absent from the cited ranges (src/lib/telemetry/genai.ts:7-14, src/actions/automation/analyze.ts:100)
L-30 (warning, citation-identifier, line 115): Identifier 'Map' is absent from the cited ranges (src/lib/mcp/rate-limit.ts:23-49)
L-31 (warning, citation-identifier, line 115): Identifier 'mcpRateLimitMax' is absent from the cited ranges (src/lib/mcp/rate-limit.ts:23-49)
L-32 (warning, citation-identifier, line 115): Identifier 'MCP_RATE_LIMIT_WINDOW_MS' is absent from the cited ranges (src/lib/mcp/rate-limit.ts:23-49)
L-33 (warning, citation-identifier, line 115): Identifier 'checkRateLimit' is absent from the cited ranges (src/lib/mcp/rate-limit.ts:23-49)
L-34 (warning, citation-identifier, line 120): Identifier '__jobsyncServerMatch' is absent from the cited ranges (src/lib/db.ts:12-18)
L-35 (warning, citation-identifier, line 138): Identifier 'renderDetail' is absent from the cited ranges (src/lib/mcp/tools/getJob.ts:95-111)
L-36 (warning, citation-identifier, line 138): Identifier 'serverMatchFailedAt' is absent from the cited ranges (src/lib/mcp/tools/getJob.ts:95-111)
L-37 (warning, citation-identifier, line 187): Identifier 'getModel' is absent from the cited ranges (node_modules/ai/dist/test/index.d.ts:53-70)
L-38 (warning, citation-identifier, line 187): Identifier 'providerOptions' is absent from the cited ranges (node_modules/ai/dist/test/index.d.ts:53-70)
L-39 (error, citation-path, line 187): Cited path resolves under no base (code root, spec store, spec dir): ai-sdk/provider/dist/index.d.ts
L-40 (warning, citation-identifier, line 233): Identifier 'add_job' is absent from the cited ranges (e2e/mcp-write-tools.spec.ts:15-32)

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v1 in place. Add no version line. Append under the v1 Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. Every citation you insert or change carries its directory-prefixed path (`src/core/typecheck.ts:30`), never a bare filename (`typecheck.ts:30`) or a bare `:<line>`. A citation that lacks a directory prefix, or a bare `:<line>` token, outside a code block is itself a finding to reject or repair before you hand off, so a later pass cannot re-resolve it to the wrong file (retro P6).
11. A citation-identifier warning on a token that is unchanged since a version where it was rejected with a reason is suppressed, not re-fired.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- version:
- words:
- accepted:
- partial:
- rejected:
- cut-scope:
- flags:
