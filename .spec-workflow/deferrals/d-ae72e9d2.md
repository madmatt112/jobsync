---
id: "d-ae72e9d2"
status: "deferred"
title: "get_job failure line: untested branch for scored job with no matchData.matchedAt"
createdAt: "2026-11-02T03:17:41.279Z"
updatedAt: "2026-11-02T03:17:41.279Z"
resolvedAt: null
originSpec: "server-side-match"
originPhase: "implementation"
revisitTrigger: "When the server-match failure-line logic in getJob.ts is next edited, or during the server-side-match retrospective, add a negative test for the no-matchedAt-while-scored branch."
tags: ["info-finding"]
resolution: null
resolvedInSpec: null
supersededBy: null
supersedes: null
owner: "harness"
---

## Context
Task-6 review (pass-equivalent, verdict findings) info finding. Tests in __tests__/mcpGetJob.spec.ts cover unscored (Req 7.4), older-matchedAt (7.4) and newer-matchedAt (7.5), but not the scored-yet-no-matchedAt branch. Not a correctness defect; recorded here so the latent coverage gap survives the retrospective rather than living only in the task review.

## Decision Deferred
No dedicated test covers the !matchedAt OR-branch at getJob.ts:118 (a visible score whose matchData lacks matchedAt, which forces the server-match failure line to show). Behavior is correct per design C9 but the branch is unasserted.

## Revisit Criteria
When the server-match failure-line logic in getJob.ts is next edited, or during the server-side-match retrospective, add a negative test for the no-matchedAt-while-scored branch.
