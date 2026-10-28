import { useState } from 'react';

/**
 * Runs `sync` synchronously during render whenever one of `deps` changes (and on first render).
 *
 * This is React's recommended "adjusting state when a prop changes" pattern. It replaces
 * `useEffect(() => { setState(...) }, deps)`, which paints stale UI first and then triggers a
 * second, cascading render. `sync` may call the component's own state setters.
 *
 * Only pass referentially stable dependencies (state, props, memoized values).
 */
export function useSyncOnChange(deps: readonly unknown[], sync: () => void): void {
  const [prev, setPrev] = useState<readonly unknown[] | null>(null);
  const changed =
    prev === null ||
    prev.length !== deps.length ||
    deps.some((dep, index) => !Object.is(dep, prev[index]));

  if (changed) {
    setPrev(deps);
    sync();
  }
}
