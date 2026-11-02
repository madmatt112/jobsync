import pLimit from "p-limit";
import { runServerMatch, type ServerMatchTask } from "@/lib/mcp/serverMatch/run";
import { takeServerMatchBudget } from "@/lib/mcp/serverMatch/budget";
import { APP_CONSTANTS } from "@/lib/constants";
import { log } from "@/lib/telemetry";
import { AiProvider } from "@/models/ai.model";

type QueueEntry = {
  task: ServerMatchTask;
  state: "queued" | "running";
  rerun: boolean;
};

type ServerMatchState = {
  entries: Map<string, QueueEntry>;
  limiter: ReturnType<typeof pLimit>;
  ollamaGate: ReturnType<typeof pLimit>;
  idleWaiters: Array<() => void>;
};

declare const globalThis: {
  __jobsyncServerMatch?: ServerMatchState;
} & typeof global;

function createState(): ServerMatchState {
  return {
    entries: new Map(),
    limiter: pLimit(APP_CONSTANTS.SERVER_MATCH_CONCURRENCY),
    ollamaGate: pLimit(1),
    idleWaiters: [],
  };
}

function getState(): ServerMatchState {
  return (globalThis.__jobsyncServerMatch ??= createState());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notifyIfIdle(state: ServerMatchState): void {
  if (state.entries.size > 0) return;
  const waiters = state.idleWaiters;
  state.idleWaiters = [];
  for (const resolve of waiters) resolve();
}

// The passed-in function only runs once p-limit schedules it on a microtask
// (never synchronously), so entry.state flips to "running" after the
// enqueueServerMatch call that started drive() has already returned. That is
// what lets two synchronous enqueues of a still-queued job both land on the
// "queued" branch below instead of racing into "running" (design C8).
async function runEntry(entry: QueueEntry): Promise<void> {
  entry.state = "running";
  await runServerMatch(entry.task);
}

async function drive(key: string): Promise<void> {
  const state = getState();

  for (;;) {
    const entry = state.entries.get(key);
    if (!entry) return;

    for (;;) {
      const budget = takeServerMatchBudget(entry.task.userId);
      if (budget.allowed) break;
      await sleep(budget.resetIn);
    }

    try {
      if (entry.task.provider === AiProvider.OLLAMA) {
        await state.ollamaGate(() => state.limiter(() => runEntry(entry)));
      } else {
        await state.limiter(() => runEntry(entry));
      }
    } catch (err) {
      log.error("[server-match] queue run failed", {
        jobId: entry.task.jobId,
        userId: entry.task.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (entry.rerun) {
      entry.rerun = false;
      entry.state = "queued";
      continue;
    }

    state.entries.delete(key);
    notifyIfIdle(state);
    return;
  }
}

export function enqueueServerMatch(task: ServerMatchTask): void {
  const state = getState();
  const key = `${task.userId}:${task.jobId}`;
  const entry = state.entries.get(key);

  if (!entry) {
    state.entries.set(key, { task, state: "queued", rerun: false });
    void drive(key);
    return;
  }

  entry.task = task;
  if (entry.state === "running") entry.rerun = true;
}

export function whenServerMatchIdle(): Promise<void> {
  const state = getState();
  if (state.entries.size === 0) return Promise.resolve();
  return new Promise((resolve) => state.idleWaiters.push(resolve));
}

export function resetServerMatchQueue(): void {
  globalThis.__jobsyncServerMatch = createState();
}
