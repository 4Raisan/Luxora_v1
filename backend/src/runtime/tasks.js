import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage();

// Work historically launched without await must finish before a serverless
// instance loses its request CPU. Each request drains only its own work.
export function trackTask(promise) {
  const tasks = scope.getStore();
  if (tasks) {
    tasks.add(promise);
    promise.then(() => tasks.delete(promise), () => tasks.delete(promise));
  }
  return promise;
}

export async function drainTasks(tasks) {
  while (tasks.size) await Promise.allSettled(tasks);
}

export function requestTasks(_req, res, next) {
  const tasks = new Set();
  const end = res.end;
  let ending = false;
  res.end = function (...args) {
    if (ending) return res;
    ending = true;
    void drainTasks(tasks).then(() => end.apply(res, args));
    return res;
  };
  scope.run(tasks, next);
}

export async function runTaskScope(work) {
  const tasks = new Set();
  return scope.run(tasks, async () => {
    try { return await work(); }
    finally { await drainTasks(tasks); }
  });
}
