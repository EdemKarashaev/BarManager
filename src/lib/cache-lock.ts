const queues = new Map<string, Promise<void>>();
const generations = new Map<string, number>();

export function cacheGeneration(userId: string) {
  return generations.get(userId) ?? 0;
}

export function invalidateCache(userId: string) {
  generations.set(userId, cacheGeneration(userId) + 1);
}

export function withCacheLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(userId) ?? Promise.resolve();

  const next = previous.then(operation);

  const tail = next.then(
    () => {},
    () => {},
  );

  queues.set(userId, tail);

  void tail.then(() => {
    if (queues.get(userId) === tail) {
      queues.delete(userId);
    }
  });

  return next;
}
