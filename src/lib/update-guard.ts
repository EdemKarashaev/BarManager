const blockers = new Set<symbol>();

export function blockUpdates(): () => void {
  const token = Symbol('update-blocker');

  blockers.add(token);

  return () => {
    blockers.delete(token);
  };
}

export function updatesBlocked(): boolean {
  return blockers.size > 0;
}