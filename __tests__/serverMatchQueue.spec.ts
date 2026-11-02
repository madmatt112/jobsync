// Contract (design C8, Req 4.10, 4.11, 6.1, 6.4, 6.5):
//
// 1. "returns synchronously, before runServerMatch is ever called"
//    Pre:   runServerMatch mocked to a never-settling promise.
//    Call:  enqueueServerMatch(task).
//    Result: runServerMatch has not been called by the time the call returns.
//    Source: design.md C8 "enqueueServerMatch ... is synchronous and returns
//            before any await" (Req 4.11).
//
// 2. "keeps hosted matches in flight at or below SERVER_MATCH_CONCURRENCY"
//    Pre:   5 distinct jobs for one user, all deepseek (hosted), runServerMatch
//           deferred per call.
//    Call:  enqueueServerMatch(task) x5, then flush microtasks.
//    Result: exactly SERVER_MATCH_CONCURRENCY calls start; resolving one lets
//            exactly one more start, never exceeding the constant.
//    Source: design.md C8 drive() step 2 / Req 6.1.
//
// 3. "keeps Ollama matches in flight at or below 1"
//    Pre:   3 distinct jobs for one user, all Ollama, runServerMatch deferred.
//    Call:  enqueueServerMatch(task) x3, then flush microtasks.
//    Result: exactly 1 call starts; resolving it lets exactly one more start.
//    Source: design.md C8 drive() step 2, the Ollama=1 rule / Req 6.1.
//
// 4. "coalesces two enqueues of a running job into one rerun with the latest task"
//    Pre:   a job's match is already running.
//    Call:  enqueueServerMatch(second task) then enqueueServerMatch(third task),
//           synchronously, for the same job.
//    Result: after the first run finishes, exactly one more run happens, and it
//            carries the third (latest) task.
//    Source: design.md C8 Enqueue post-conditions, "Entry running" branch,
//            D14 / Req 4.10.
//
// 5. "coalesces two enqueues of a still-queued job into one run with the latest task"
//    Pre:   a job's match has been enqueued but drive() has not yet reached
//           "running" (no await between the two enqueue calls).
//    Call:  enqueueServerMatch(first task) then enqueueServerMatch(second task).
//    Result: exactly one run happens, carrying the second (latest) task.
//    Source: design.md C8 Enqueue post-conditions, "Entry queued" branch / Req 4.10.
//
// 6. "waits for the budget's resetIn before running an over-budget match, without failing"
//    Pre:   takeServerMatchBudget refuses once with resetIn 1000, then allows.
//    Call:  enqueueServerMatch(task), advance fake timers by 999 then 1 more ms.
//    Result: runServerMatch is not called before 1000ms elapse, and is called
//            once the full resetIn has elapsed.
//    Source: design.md C8 drive() step 1, D6 / Req 6.4.
//
// 7. "leaves checkRateLimit(userId) reporting a fresh user's remaining after 50 runs"
//    Pre:   a fresh userId never seen by checkRateLimit, real (unmocked) budget.
//    Call:  enqueueServerMatch(task) x50 for that user, await whenServerMatchIdle().
//    Result: checkRateLimit(userId) reports the same shape as an untouched user.
//    Source: design.md C8 "It never calls checkRateLimit"; requirements.md Req 6.5.
//
// 8. "logs a rejecting run and still runs its coalesced rerun" (NFR reliability,
//    cited in this task's own Prompt/Success text and design.md Error Handling
//    #4 / C8 drive() step 3-4; not itself a numbered Req id).
//    Pre:   a job's first run rejects; a rerun is queued while it runs.
//    Call:  enqueueServerMatch(task), then enqueueServerMatch(rerun task) while
//           the first run is in flight, await whenServerMatchIdle().
//    Result: one error line is logged, and the coalesced rerun still runs.
//    Source: design.md C8 drive() step 3 ("A throw is logged and treated as a
//            failure") and step 4 (rerun check happens on finish regardless).

import { runServerMatch, type ServerMatchTask } from "@/lib/mcp/serverMatch/run";
import { takeServerMatchBudget } from "@/lib/mcp/serverMatch/budget";
import {
  enqueueServerMatch,
  whenServerMatchIdle,
  resetServerMatchQueue,
} from "@/lib/mcp/serverMatch/queue";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import { RATE_LIMITS } from "@/lib/ai/config";
import { APP_CONSTANTS } from "@/lib/constants";
import { log } from "@/lib/telemetry";
import { AiProvider } from "@/models/ai.model";

vi.mock("@/lib/mcp/serverMatch/run", () => ({ runServerMatch: vi.fn() }));

vi.mock("@/lib/mcp/serverMatch/budget", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/mcp/serverMatch/budget")>();
  return { ...actual, takeServerMatchBudget: vi.fn(actual.takeServerMatchBudget) };
});

const run = runServerMatch as unknown as ReturnType<typeof vi.fn>;
const budget = takeServerMatchBudget as unknown as ReturnType<typeof vi.fn>;

function trackedRuns() {
  const pending: { resolve: (value: string) => void }[] = [];
  const impl = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        pending.push({ resolve });
      }),
  );
  return { impl, pending };
}

describe("enqueueServerMatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetServerMatchQueue();
    run.mockReset();
    run.mockResolvedValue("saved");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns synchronously, before runServerMatch is ever called", () => {
    let resolveRun: ((value: string) => void) | undefined;
    run.mockImplementation(
      () => new Promise<string>((resolve) => { resolveRun = resolve; }),
    );

    enqueueServerMatch({
      jobId: "job-sync",
      userId: "u-sync-return",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });

    expect(run).not.toHaveBeenCalled();
    resolveRun?.("saved");
  });

  it("keeps hosted matches in flight at or below SERVER_MATCH_CONCURRENCY", async () => {
    const { impl, pending } = trackedRuns();
    run.mockImplementation(impl);

    for (let i = 0; i < 5; i++) {
      enqueueServerMatch({
        jobId: `job-conc-${i}`,
        userId: "u-conc-hosted",
        provider: AiProvider.DEEPSEEK,
        model: "deepseek-flash",
      });
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(APP_CONSTANTS.SERVER_MATCH_CONCURRENCY);

    pending.shift()!.resolve("saved");
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(APP_CONSTANTS.SERVER_MATCH_CONCURRENCY + 1);

    // Draining the backlog is itself what frees the last slot, so the final
    // backlog entry's pending resolver only appears after this loop's own
    // resolve calls cascade through a later microtask tick — interleave
    // drain and advance rounds until nothing new shows up.
    while (pending.length || run.mock.calls.length < 5) {
      while (pending.length) pending.shift()!.resolve("saved");
      await vi.advanceTimersByTimeAsync(0);
    }
    await whenServerMatchIdle();
  });

  it("keeps Ollama matches in flight at or below 1", async () => {
    const { impl, pending } = trackedRuns();
    run.mockImplementation(impl);

    for (let i = 0; i < 3; i++) {
      enqueueServerMatch({
        jobId: `job-ollama-${i}`,
        userId: "u-conc-ollama",
        provider: AiProvider.OLLAMA,
        model: "llama3.2",
      });
    }

    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    pending.shift()!.resolve("saved");
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);

    // See the comment on the equivalent drain above (hosted-concurrency
    // test): the last backlog entry's resolver only appears once this
    // loop's own resolutions cascade, so drain-and-advance repeatedly.
    while (pending.length || run.mock.calls.length < 3) {
      while (pending.length) pending.shift()!.resolve("saved");
      await vi.advanceTimersByTimeAsync(0);
    }
    await whenServerMatchIdle();
  });

  it("coalesces two enqueues of a running job into one rerun with the latest task", async () => {
    const { impl, pending } = trackedRuns();
    run.mockImplementation(impl);

    const first: ServerMatchTask = {
      jobId: "job-rerun",
      userId: "u-rerun",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    };
    const second: ServerMatchTask = { ...first, model: "deepseek-chat" };
    const third: ServerMatchTask = { ...first, model: "deepseek-reasoner" };

    enqueueServerMatch(first);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    enqueueServerMatch(second);
    enqueueServerMatch(third);

    pending.shift()!.resolve("saved");
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1][0]).toEqual(third);

    pending.shift()!.resolve("saved");
    await whenServerMatchIdle();
  });

  it("coalesces two enqueues of a still-queued job into one run with the latest task", async () => {
    const { impl, pending } = trackedRuns();
    run.mockImplementation(impl);

    const first: ServerMatchTask = {
      jobId: "job-queued",
      userId: "u-queued",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    };
    const second: ServerMatchTask = { ...first, model: "deepseek-chat" };

    enqueueServerMatch(first);
    enqueueServerMatch(second);

    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toEqual(second);

    pending.shift()!.resolve("saved");
    await whenServerMatchIdle();
  });

  it("waits for the budget's resetIn before running an over-budget match, without failing", async () => {
    budget.mockReturnValueOnce({ allowed: false, resetIn: 1000 });

    enqueueServerMatch({
      jobId: "job-budget",
      userId: "u-budget-wait",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);

    await whenServerMatchIdle();
  });

  it("leaves checkRateLimit(userId) reporting a fresh user's remaining after 50 runs through the real budget", async () => {
    const userId = "u-budget-separate";

    for (let i = 0; i < 50; i++) {
      enqueueServerMatch({
        jobId: `job-budget-sep-${i}`,
        userId,
        provider: AiProvider.DEEPSEEK,
        model: "deepseek-flash",
      });
    }

    await whenServerMatchIdle();

    expect(checkRateLimit(userId)).toEqual({
      allowed: true,
      remaining: RATE_LIMITS.MAX_REQUESTS - 1,
      resetIn: RATE_LIMITS.WINDOW_MS,
    });
  });

  it("logs a rejecting run and still runs its coalesced rerun", async () => {
    vi.spyOn(log, "error").mockImplementation(() => {});
    run.mockRejectedValueOnce(new Error("boom"));
    run.mockResolvedValueOnce("saved");

    const task: ServerMatchTask = {
      jobId: "job-fail",
      userId: "u-fail",
      provider: AiProvider.DEEPSEEK,
      model: "deepseek-flash",
    };
    const rerunTask: ServerMatchTask = { ...task, model: "deepseek-chat" };

    enqueueServerMatch(task);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    enqueueServerMatch(rerunTask);

    await whenServerMatchIdle();

    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1][0]).toEqual(rerunTask);
    expect(log.error).toHaveBeenCalled();
  });
});
