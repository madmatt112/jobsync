# Shared Constant Import Convention

When a task introduces a shared constant, follow these rules.

## Decomposition

- Name the exact module path for the constant in the task. For example,
  `@/lib/ai/matchProviderOptions`.
- Add that module to the task file list.
- Do not route the constant through a barrel such as `src/lib/ai/index.ts`.

## Implementation

- Import the constant directly from its module.
- Match the import style of a sibling file that already uses the constant. For
  example, `matchJob.ts` imports `MATCH_PROVIDER_OPTIONS` directly from
  `@/lib/ai/matchProviderOptions`.
- Do not add a barrel re-export outside the task file list.

## Why

Task 2 of `server-side-match` first added a `MATCH_PROVIDER_OPTIONS` re-export to
the `@/lib/ai` barrel (`src/lib/ai/index.ts`), which was outside the task file
list. The fix round reverted to a direct import from
`@/lib/ai/matchProviderOptions`, which matches `matchJob.ts`. A direct import
keeps the task inside its named files and keeps the import style consistent.
