import { useState } from 'react';

/**
 * Returns the latest non-null value it has received.
 *
 * Bottom sheets keep animating for a short moment after their data is cleared (`null`).
 * Holding on to the last real value keeps the content stable while the sheet slides out,
 * without reading or mutating a ref during render (uses React's "adjust state while rendering" pattern).
 */
export function useLastDefined<T>(value: T | null | undefined): T | null {
  const [last, setLast] = useState<T | null>(value ?? null);
  if (value != null && value !== last) {
    setLast(value);
  }
  return value ?? last;
}
