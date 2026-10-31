# Adversarial Analysis — mcp-write-tools/design (v3)

Round 3. Primary surface: feasibility, consistency, edge cases.
Fresh lens: requirements traceability and scope fidelity (every AC → component,
carried items R4-1/R5-5 and deferred narrow-check items resolved, no scope drift
from the fixes).

## Deltas attacked first (fix-induced re-checks)

The prompt reports no v2 checkpoint commit, so no diff was available; I re-checked
the three v3 deltas (R2-1, R2-2, R2-3) against the requirement each had to satisfy,
scoped to the changed text, not a full re-review.

- **R2-1 (e2e, MUST_FIX) — resolved.** Design line 169 now pins both binding gates
  the memory required. Leg A: `update_job` posting "at least 150 words so
  `classifyDescriptionCompleteness` returns `full` and clears … the `title-only`
  word-count gate (`DESCRIPTION_PARTIAL_MIN_WORDS` 40 …), not merely the 200-char
  `preprocessJob` floor" — verified `classifyDescriptionCompleteness`
  (`descriptionCompleteness.ts:12-19`, word count < 40 → title-only) runs ahead of
  `preprocessJob`, and `update_job` persists the result (`updateJobFromNames.ts:161-163`
  sets `data.descriptionCompleteness`), so the later `get_job` rescore reads `full`
  and clears step 1. Leg B: the e2e now seeds a resume "whose serialized text clears
  `preprocessResume`'s 200-char floor" and states `createResumeForMatching`
  (`e2e/automations.spec.ts:9-59`) "alone serializes to about 130 characters, so give
  it more section content" — the ~130-char figure and the helper's two-section intent
  (`MIN_RESUME_SECTIONS_FOR_SELECTION`) are accurate. Both legs now emit a directive;
  the note case is correctly named (resume < 200 chars or description < 40 words).

- **R2-2 (profile race, SHOULD_FIX) — resolved.** C3 Ownership (line 79) now states
  the find-or-create is unguarded (`Profile.userId` not unique,
  `schema.prisma:71-77`), the duplicate-profile race is tolerated as it pre-exists in
  `createResume` (`resumeUpload.ts:39-71`), letters stay visible via
  `getCoverLetterList`'s `profile: { userId }` filter, and no migration is added —
  the one-line documented assumption the memory said to accept.

- **R2-3 (render in transaction, MINOR) — resolved.** C3 step 2 (line 67) now renders
  `md.render(markdown)` "before any transaction" and step e stores it; verified
  against the template `coverLetter.actions.ts:192` (renders before the `$transaction`
  at `:194`). The SQLite write lock no longer covers the render.

## What I checked and how (fresh lens)

- **AC → component map.** Walked all 9 requirements. R1→C1/C2, R2→C1, R3→C2/C8,
  R4→C3, R5→C3, R6→C3, R7→C4/C2, R8→C5/C6/C7, R9→C4/C6/C8. Every behavioral AC maps,
  except R1 AC6 (see R3-2).
- **Library-capability claims probed.** `markdown-it ^14.3.0` is in `package.json:74`
  and `node_modules/markdown-it` resolves to `14.3.0`. The design's
  `new MarkdownIt({ html: false, linkify: false, breaks: true })` matches
  `coverLetter.actions.ts:11` byte-for-byte (read the line) and R4 AC2's "same renderer
  settings". No unproven API capability carried forward.
- **C6 lookups grounded.** `resolveJobForAgent` (`jobLookup.ts:12-27`) uses `include`,
  so all Job scalars (`description`, `resumeId`, …) return for `preprocessJob`;
  `resolveResumeForAgent` (`resumeLookup.ts:44-90`) exposes `no_resumes` /
  `needs_selection`; the job-first preprocess check order matches `matchJob.ts:71-86`.
- **Citations that changed/narrowed.** `getJob.ts:45-46` (day helper, `.slice(0,10)`),
  cleanup body `route.ts:21-53`, `findJob.ts:36/:46/:59-61`, `formatJobRow`
  `jobQuery.ts:311-324` (9 fields, field 8 `match`, origin last) — all accurate.
- **Carried + deferred items.** R4-1 resolved in C3/D13; R5-5 in C5/scope note;
  deferred narrow-check items by D6/D7. No scope drift detected from the fixes.

Citation fidelity remains perfect. The one real defect is a document-internal
contradiction, not a misstatement of the codebase.

## Findings

### R3-1 — SHOULD_FIX — Novel (fresh lens: consistency/traceability), carried — C6 both keeps and forbids "default resume"

D6 (line 178) chose, for the opening line, "naming the resolved resume id **and the
choice order**", rejecting "keeping 'default resume'". C6 block 1 (line 110)
implements that choice with the illustrative opening line:

> "…using resume id {resumeId}, the resume the in-app Match picks (the job's linked
> resume, **else the default resume**, else the only one)."

The literal string `default resume` is present, by design — it describes the
fallback order. But the very next clause of the same block asserts "**The text no
longer says 'default resume'** (deferred item 1)", and the unit test in Testing
Strategy (line 166) pins "**no 'default resume' text**". A developer who writes the
opening line as illustrated (the D6-chosen behaviour) and the test as specified gets
a failing test: `expect(directive).not.toContain("default resume")` fails on
"else the default resume". The design is internally inconsistent across three places
— the D6 decision, the C6 post-condition claim, and the test assertion.

The D6 intent is sound: don't **misdescribe** the match as being against "the user's
default resume" (the old `:29-30` wording, which is wrong for a job-linked resume).
The error is only that the post-condition sentence and the test are stated as a blanket
substring ban instead of a ban on the old misdescription. Fix: narrow both to the old
phrasing (e.g. the directive no longer says it matches "against the user's default
resume" / no longer presents the default as *the* resume), or drop "default resume"
from the parenthetical choice order — but D6 deliberately kept the choice order, so
tightening the claim and the test is the honest fix. Left unreconciled, the one unit
test that guards the D6 correction cannot pass against the directive the design
specifies.

### R3-2 — MINOR — Novel (fresh lens: traceability) — R1 AC6 (dismissed/discovery jobs) satisfied but untraced

R1 AC6 ("`update_job` on a job with a discovery status, including 'dismissed', SHALL
update it like any other owned job") is a plain behavioral AC, not marked invariant.
C1 enumerates R1 AC2/AC3/AC4 and the `where` change but never names AC6. It holds —
`updateJobFromNames` has no discovery/status gate (grep: the pre-check and transaction
`where` key only on `id`+`userId`+`createdVia`; after the change, `id`+`userId`), so
removing `createdVia` is sufficient. No change needed, but the trace is implicit; a
one-clause note in C1 ("no discovery-status gate exists, so R1 AC6 holds once
`createdVia` is dropped") would close the map. Does not keep the loop alive.

## Top risks / gaps

1. **R3-1** — the only unit test guarding the D6 "default resume" correction
   (`mcpMatchDirective.spec.ts`, "no 'default resume' text") cannot pass against the
   directive C6 specifies, which includes "else the default resume" in its choice
   order. A verbatim implementation produces a failing test and rework.
2. The e2e (R8 AC4) is now executable on both legs; the recurring weak spot across
   v1/v2 is closed. No residual risk there.
3. **R3-2** — R1 AC6 (dismissed jobs) holds but is not traced in C1; cosmetic.

## Top conclusions to challenge or reverse

1. **"The text no longer says 'default resume'" (C6 block 1) and "no 'default resume'
   text" (Testing Strategy).** Reverse: the design's own D6-chosen opening line keeps
   "else the default resume". Both the claim and the test are over-strict and
   contradict the chosen wording (R3-1).
2. Everything else surveyed under the traceability lens stands: the AC→component map
   is complete, the carried items (R4-1, R5-5) and deferred items (D6/D7) are resolved,
   the markdown-it capability is grounded in the installed 14.3.0, and no scope drifted
   in from the three fixes.

## What's missing before acting

- Reconcile R3-1: tighten the C6 post-condition and the `mcpMatchDirective.spec.ts`
  assertion to forbid the old "against the user's default resume" misdescription
  rather than the bare substring "default resume", or remove the phrase from the
  choice order. One edit, two sites.
- Optional: add a one-clause R1 AC6 note to C1 (R3-2).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
