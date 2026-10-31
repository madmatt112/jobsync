R3-1: addressed — C6 block 1 (design.md:110) and the Testing Strategy assertion (design.md:166) now both forbid only the old "against the user's default resume" misdescription, not the bare substring, so they no longer contradict the kept "else the default resume" choice-order wording; matches Revision History v4 (design.md:202).
R3-2: addressed — C1 post-conditions (design.md:43) now state no discovery-status gate exists in `updateJobFromNames`'s `where` (keys only on id, userId, createdVia), so R1 AC6 (dismissed jobs) is traced; matches Revision History v4 (design.md:203).

VERIFIED: 2/2
