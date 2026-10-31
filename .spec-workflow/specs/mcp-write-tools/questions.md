# Questions — mcp-write-tools

## Gate A

1. **Posture.** Money, personal-data/erasure and legal posture: what stance does this spec take?
   - options: No money/refunds/credits; data stays in the user's self-hosted DB; no MCP delete path, redrafts never destroy a letter, erasure stays the in-app delete; no compliance framing beyond self-hosting | Add an MCP delete path for cover letters | Overwrite a letter in place on redraft
   - answer: No money/refunds/credits; data stays in the user's self-hosted DB; no MCP delete path, redrafts never destroy a letter, erasure stays the in-app delete; no compliance framing beyond self-hosting (approve)

2. **Versions.** How are cover-letter redraft versions stored?
   - options: New CoverLetter row per save, job repointed (matches in-app Regenerate, no migration) | Overwrite the current letter in place | New version table with a schema migration
   - answer: New CoverLetter row per save, job repointed (matches in-app Regenerate, no migration) (approve)

3. **Scope.** Which token scope gates save_cover_letter?
   - options: Existing jobs:write scope | New cover-letter write scope issued on new tokens, implied for old ones | No scope gate, like the resume-review tools
   - answer: Existing jobs:write scope (approve)

4. **Upsert.** Does add_job's upsert path also lose the MCP-only (createdVia) restriction?
   - options: Yes, lift it with update_job (shared patch helper) | No, keep upsert limited to MCP-created duplicates
   - answer: Yes, lift it with update_job (shared patch helper) (approve)

5. **Added date.** What does the 'date added' field on list/search rows mean?
   - options: Job createdAt (what get_job prints as Created) | discoveredAt for automation jobs | Applied date
   - answer: Job createdAt (what get_job prints as Created) (approve)

## Gate B

Plan approved by Matthew on 2026-10-07 with the class-a veto items unannotated: tasks 1, 2, 3, 4, 9, 11, 12 (all "destructive: drop" keyword flags).
