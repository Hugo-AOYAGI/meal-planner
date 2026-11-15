import type { UIMessageChunk } from "ai";

/**
 * The single run in progress (the agent process is heavy: one app-wide).
 * It belongs to the server, not to the request that started it, so it goes on when the client leaves.
 * Its chunks are kept until it ends so a returning client can replay the turn from the start.
 */
interface LiveRun {
  conversationId: string;
  chunks: UIMessageChunk[];
  waiting: Set<() => void>;
  done: boolean;
  controller: AbortController;
}

let live: LiveRun | null = null;

export const isBusy = () => live !== null;

export const liveRun = (conversationId: string) => (live?.conversationId === conversationId ? live : null);

export const stopRun = () => live?.controller.abort();

/** Starts consuming `source` in the background; only `stopRun` interrupts it. */
export function startRun(conversationId: string, source: (signal: AbortSignal) => ReadableStream<UIMessageChunk>): LiveRun {
  const run: LiveRun = { conversationId, chunks: [], waiting: new Set(), done: false, controller: new AbortController() };
  const wake = () => {
    for (const resolve of run.waiting) resolve();
    run.waiting.clear();
  };
  live = run;
  void (async () => {
    try {
      for await (const chunk of source(run.controller.signal)) {
        run.chunks.push(chunk);
        wake();
      }
    } catch (e) {
      console.error(e);
    } finally {
      run.done = true;
      live = null;
      wake();
    }
  })();
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
