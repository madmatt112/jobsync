# End-to-end verification — task 20

Run 2026-09-21 against jobsync_app (image built from fork/integration at f095da3), container MCP_RATE_LIMIT_MAX=80 for this run, then restored to 60.
Fixture: throwaway user e2e-fixture@example.invalid with 29 jobs (28 visible + 1 dismissed) and a second user with 1 job; three tokens (jobs:read / legacy jobs:write / questions:write). Scripts kept at ~/jobsync-deploy/e2e/.

```
PASS  [6.1] tools/list advertises the three read tools among twelve  -- "['add_job', 'find_job', 'get_job', 'list_jobs', 'search_jobs', 'update_job', 'add_question', 'save_match_resul"
PASS  [6.2] get_job refuses a questions:write-only token  -- 'Insufficient scope. Required: jobs:read'
PASS  [6.3] get_job serves a legacy jobs:write-only token  -- 'Job d46a85f5-60ce-458a-b718-bd6acf846844'
PASS  [6.2] list_jobs refuses a questions:write-only token  -- 'Insufficient scope. Required: jobs:read'
PASS  [6.3] list_jobs serves a legacy jobs:write-only token  -- '28 matched now, showing rows 1-25, sorte'
PASS  [6.2] search_jobs refuses a questions:write-only token  -- 'Insufficient scope. Required: jobs:read'
PASS  [6.3] search_jobs serves a legacy jobs:write-only token  -- 'No jobs match.'
PASS  [1.1] no-arg list: header says 28 matched, rows 1-25, newest first  -- '28 matched now, showing rows 1-25, sorted by created desc.'
PASS  [1.2] row carries id, title @ company, status, applied, due, location, source, match, origin  -- '0669bb67-28ae-487d-bd89-c3740de631ed | Senior Engineer / Lead @ Acme Robotics | draft | applied - | due - | - '
PASS  [1.3] cursor footer present on an overflowing page  -- 'Next page: call list_jobs again with the same arguments plus'
PASS  [5.2] exactly one line per job (25 rows + header + footer)  -- '27 lines'
PASS  [5.5] default page is compact  -- '4146 bytes'
PASS  [1.4] cursor walk returns every visible job exactly once, no repeats  -- '2 pages, 28 ids'
PASS  [8.1] another user's job never appears
PASS  [1.5] no match is one plain line
PASS  [1.6a] dismissed discovery hidden by default
PASS  [1.6b] …and returned when asked for by discovery status  -- "['eb6d08d9-0698-4f2a-a2cc-da83938102b3']"
PASS  [1.7] unanalyzed score renders as 'match -'
PASS  [5.2b] newline and pipe in a title stay on one sanitized line  -- '0669bb67-28ae-487d-bd89-c3740de631ed | Senior Engineer / Lead @ Acme Robotics | draft | applied - | due - | - '
PASS  [2.1a] status filter
PASS  [2.1b] company substring
PASS  [2.2] company substring is case-insensitive (ASCII)
PASS  [2.1c] location substring
PASS  [2.1d] applied=false
PASS  [2.1e] tag substring
PASS  [2.1f] createdVia substring
PASS  [2.1g] origin=app excludes mcp and chat jobs
PASS  [2.1h] origin=mcp
PASS  [2.1i] origin=chat
PASS  [2.1j] match-score range selects the analyzed 78
PASS  [8.4] match-score range cannot reach the hidden 95
PASS  [2.1k] created date range
PASS  [2.1l] filters AND together
PASS  [2.3] unknown status is rejected (SDK -32602) and the values are advertised in the schema enum  -- 'MCP error -32602: Input validation error: Invalid arguments for tool list_jobs: Invalid input at status'
PASS  [2.6a] limit 101 rejected
PASS  [2.6b] limit 0 rejected
PASS  [2.6c] limit 100 serves everything on one page
PASS  [2.4a] sort by applied desc: dated rows first, descending
PASS  [2.5] sort by applied asc: null run first, then ascending
PASS  [2.4b] paging across the null boundary (desc, limit 5) loses and repeats nothing  -- '6 pages'
PASS  [2.4b] paging across the null boundary (asc, limit 5) loses and repeats nothing  -- '6 pages'
PASS  [2.4c] paging by due date with shared/null values is complete
PASS  [5.4] bad cursor is a text error telling the agent to restart  -- 'Cursor is invalid or was issued for different filters or sort. Re-run the query without a cursor to start agai'
PASS  [3.1a] query hits title
PASS  [3.1b] query hits notes
PASS  [3.1c] query hits description
PASS  [3.1d] query hits company, dismissed still hidden
PASS  [3.1e] query is case-insensitive (ASCII)
PASS  [3.3] repost under a different URL is found by title+company
PASS  [3.2a] search honours filters
PASS  [3.2b] search pages with a cursor like list_jobs
PASS  [3.2c] search rejects a list_jobs cursor (different fingerprint)
PASS  [4.1] get_job renders every section of a full record
PASS  [4.2] absent fields and empty sections are omitted
PASS  [4.3] unowned id answers exactly like a nonexistent id  -- 'No job with that id.'
PASS  [4.4] get_job hides the unanalyzed score
PASS  [5.3] get_job is sectioned
PASS  [7.1/7.2/9.1] call #81 is refused after 80 handler calls (MCP_RATE_LIMIT_MAX=80), whatever the page size  -- 'Rate limit exceeded. Try again in 3599s.'

58 passed, 0 failed
```

Earlier runs: 51/58 (found the non-nullable keyset arm bug and the SDK-level validation path; two script mistakes), 56/58 twice (script budget ordering only).
