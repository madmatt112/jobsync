# Narrow check — server-side-match/requirements v3

S-1: addressed — AC4.10 now serializes to one running match per job plus at most one coalesced pending re-match reading the description at its own run time, so matches never run concurrently and the later run (reading newer text) always wins over the earlier; AC7.6 extends the drop to "before or while its queued match runs" and explicitly overrides criteria 5.5 and 7.3, giving a stated mid-run-delete outcome; D14 records the serialization rationale.

VERIFIED: 1/1

## Deferred findings

- None.
