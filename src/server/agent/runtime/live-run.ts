import type { UIMessageChunk } from "ai";

/**
 * The turns of the assistant, one at a time (the agent process is heavy: one app-wide), the others waiting in line.
 * A turn belongs to the server, not to the request that queued it, so it goes on when the client leaves.
 * Its chunks are kept until it ends so a returning client can replay the turn from the start.
 * The queue lives in memory: a restart forgets the waiting turns.
 */
interface LiveRun {
  conversationId: string;
  chunks: UIMessageChunk[];
  waiting: Set<() => void>;
  done: boolean;
  controller: AbortController;
  start: () => void;
}

let live: LiveRun | null = null;
const queue: LiveRun[] = [];

export const isBusy = () => live !== null;

/** The turn running for this conversation (not one still waiting). */
export const liveRun = (conversationId: string) => (live?.conversationId === conversationId ? live : null);

/** Stops this conversation's turns, the running one and those waiting. */
export function stopRuns(conversationId: string) {
  for (const run of [live, ...queue]) if (run?.conversationId === conversationId) run.controller.abort();
}

function startNext() {
  live = queue.shift() ?? null;
  live?.start();
}

/**
 * Queues a turn; `source` is only called when its turn comes, and only `stopRuns` interrupts it.
 * `initial` chunks are sent right away to whoever follows it, even while it waits.
 */
export function queueRun(conversationId: string, source: (signal: AbortSignal) => ReadableStream<UIMessageChunk>, initial: UIMessageChunk[] = []): LiveRun {
  const run: LiveRun = { conversationId, chunks: [...initial], waiting: new Set(), done: false, controller: new AbortController(), start: () => {} };
  const wake = () => {
    for (const resolve of run.waiting) resolve();
    run.waiting.clear();
  };
  const end = () => {
    run.done = true;
    wake();
  };
  run.start = () =>
    void (async () => {
      try {
        for await (const chunk of source(run.controller.signal)) {
          run.chunks.push(chunk);
          wake();
        }
      } catch (e) {
        console.error(e);
      } finally {
        end();
        startNext();
      }
    })();
  // stopped before its turn: it just leaves the line
  run.controller.signal.addEventListener("abort", () => {
    const index = queue.indexOf(run);
    if (index < 0) return;
    queue.splice(index, 1);
    end();
  });
  queue.push(run);
  if (!live) startNext();
  return run;
}

/** The run from its first chunk, then live until it ends. Cancelling it (client gone) does not touch the run. */
export function follow(run: LiveRun): ReadableStream<UIMessageChunk> {
  let next = 0;
  return new ReadableStream({
    async pull(controller) {
      while (next >= run.chunks.length && !run.done) await new Promise<void>((resolve) => run.waiting.add(resolve));
      if (next < run.chunks.length) controller.enqueue(run.chunks[next++]!);
      else controller.close();
    },
  });
}
