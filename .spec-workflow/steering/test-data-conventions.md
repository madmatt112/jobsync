# Test Data Conventions — Seed Floors

These are the numeric floors that seeded test data must clear. When a fixture
sits below a floor and an agent path returns a note instead of a directive, fix
the seed data to clear the floor. Do not lower the floor in a design sketch or
weaken the gate.

## Resume seed floors

- **Serialized resume text >= 200 characters.** This is the `preprocessResume`
  floor (`MIN_CHAR_COUNT` in `src/lib/ai/tools/preprocessing.ts`). The helper
  `createResumeForMatching` alone serializes to about 130 characters, which is
  below the floor. Add section content (for example a long Summary) so the text
  clears 200 characters.
- **Minimum sections.** The resume must satisfy `hasMinResumeSections`
  (`src/lib/resumeSections.ts`). Seed at least two sections; a Summary plus a
  Certification is the lightest pair.
- **Default resume.** Mark the seeded resume default so `resolveResumeForAgent`
  resolves it for the token user (design D5).

## Job description seed floors

- **Match directive needs >= 150 words.** `classifyDescriptionCompleteness`
  returns `full` only at or above `DESCRIPTION_FULL_MIN_WORDS` (150,
  `src/lib/constants.ts`). A `full` description clears `buildMatchOffer`'s
  title-only word-count gate, so `get_job` and `update_job` can emit a match
  directive. Seed a posting of at least 150 words for directive cases.
- **Partial floor is 40 words.** Below `DESCRIPTION_PARTIAL_MIN_WORDS` (40,
  `src/lib/constants.ts`) the description is a title stub and
  `buildMatchOffer` returns a note, never a directive.
- **Job preprocess floor is 200 characters.** `preprocessJob` shares the same
  `MIN_CHAR_COUNT` of 200. This is a lower bar than the 150-word full gate; a
  150-word posting clears both.

## Directive-vs-note rule

A match directive needs **both** a resume of at least 200 characters **and** a
description of at least 150 words. A resume under 200 characters, or a
description under 40 words, makes `buildMatchOffer` return a note. Seed above
both floors whenever a test expects a directive.

## Cover letter input floor

- **Cover letter text >= 10 characters.** `save_cover_letter` validates against
  `MIN_COVER_LETTER_CHARS` (10, `src/lib/constants.ts`). Supply more than 10
  characters of letter text.
