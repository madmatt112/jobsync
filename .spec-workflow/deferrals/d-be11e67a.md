---
id: "d-be11e67a"
status: "resolved"
title: "Run the mcp-write-tools e2e spec on a seeded test instance"
createdAt: "2026-10-07T07:48:53.980Z"
updatedAt: "2026-10-08T21:10:24.256Z"
resolvedAt: "2026-10-08T21:10:24.256Z"
originSpec: "mcp-write-tools"
originPhase: "implementation"
revisitTrigger: "When a seeded e2e test instance is available (not the :3737 homelab), or before relying on the e2e coverage of the write tools."
tags: ["verification", "e2e"]
resolution: "PR #3 (a5c5462) stabilised the default-resume step; mcp-write-tools e2e verified green twice against a throwaway seeded instance on :3838."
resolvedInSpec: "mcp-write-tools"
supersededBy: null
supersedes: null
---

## Context
Task 12 added e2e/mcp-write-tools.spec.ts plus cover-letter teardown in src/app/api/test/cleanup/route.ts and e2e/fixtures.ts. Lint, the full unit suite and the project typecheck pass, and a static review confirmed every assertion traces to current source. But the e2e test itself was never executed in this environment: there is no seeded e2e test instance, and the only running dev server (:3737) is the user's real-data homelab, which rejects the seeded admin login and must never be used for e2e. So the actual end-to-end run is deferred.

## Decision Deferred
The command `npm run test:e2e -- mcp-write-tools` (equivalently `npx playwright test --project=chromium mcp-write-tools`) was not run; task 12 was verified by static review only, not by a green e2e run.

## Revisit Criteria
Run `npm run test:e2e -- mcp-write-tools` against a seeded test instance and confirm it is green: update_job returns "Job {id} updated.", the list_jobs row ends with today's UTC added date, the saved cover letter shows in the Cover Letter tab, get_job with matchDirective:true returns a directive carrying the save_match_result call-back, and cleanup removes the created letter.
