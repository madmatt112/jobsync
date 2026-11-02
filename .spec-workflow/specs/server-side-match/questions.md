## Gate B

1. Approve the task plan, or annotate it? Reply "Approve" to proceed, or type an annotation to revise the tasks once before implementation.
   Options: Approve | Annotate
   Answer: Annotation (operator): No task may read, write, migrate or copy anything under /home/mcf/jobsync-deploy; that is the live instance. Every prisma generate, prisma migrate deploy, vitest and e2e step runs against a throwaway SQLite file inside the run worktree: set DATABASE_URL=file:./prisma/test.db for that command (create it with prisma migrate deploy from an empty file), and never commit it or any .env file. State this in the Restrictions of tasks 6 and 14 and in any other task that runs prisma or a database-backed test. Change nothing else in the plan.
