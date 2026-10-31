# Narrow check — mcp-write-tools/requirements v6

R5-1: addressed — v6 R8 AC1 now replaces only the resume block, instructions and four-section format (matchDirective.ts:31-48) and explicitly keeps the jobId (:29) and the resumeId plus save_match_result call-back (:49-50), verified against the current file.
R5-2: addressed — v6 R8 AC2 makes the directive resolve its resume the way in-app Match does, resolveResumeForAgent with job.resumeId as page resume (matchJob.ts:57-60, resumeLookup.ts:44-90), removing the default-vs-job-linked resume divergence R5-2 found.
R5-3: addressed — v6 R8 AC3(c) rewords the partial-description addition as a conditional rule ("only a thin description...", "calls update_job first where that tool exists"), neutralizing the unconditional-firing and dead-in-app-tool complaints, while the MCP directive keeps its own completeness-gated instance (matchDirective.ts:18-26, confirmed).
R5-4: addressed — v6 R9 AC5 now exempts embedded resume/job text from the forbidden-phrase checks (scoping the absolute guarantee to the directive's own/template text) while still requiring no line, embedded text included, start with the batch prefix, with design picking the neutralizing step; the bracket gloss now matches addJobsBatch.ts:17's actual `[${i+1}/${total}] ` format.

VERIFIED: 4/4

## Deferred findings
- R8 AC1's kept directive opening text (matchDirective.ts:29, "against the user's default resume") is not updated to reflect AC2's resume-source change (job-linked resume via resolveResumeForAgent); the wording would misdescribe the resume actually used once AC2 ships.
- R8 AC3(c)'s shared conditional warning and the MCP directive's own completeness-gated warning (matchDirective.ts:18-26) both surviving creates a potential duplicate instruction for partial-description MCP jobs; not stated whether the MCP-specific one is meant to supersede or stack with the shared one.
