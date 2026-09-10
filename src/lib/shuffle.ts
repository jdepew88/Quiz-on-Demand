/**
 * Unbiased randomization.
 *
 * Adapted from the Fisher-Yates helper in the source exam engine. Two properties matter
 * and both are covered by tests:
 *
 *  1. It copies. The array handed in is never mutated, so the uploaded source questions
 *     survive any number of attempts unchanged.
 *  2. It is unbiased. `[...items].sort(() => Math.random() - 0.5)` is not — comparison
 *     sorts with an inconsistent comparator skew heavily toward near-identity orderings,
 *     and V8's sort makes that skew reproducible rather than random.
 *
 * `rng` is injectable purely so tests can drive a deterministic sequence; the app always
 * uses the default.
 */

export type RandomSource = () => number;

/** Returns a new array containing `items` in a uniformly random order. */
export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    // `copy` has fixed length here, so both indices are in range; the swap is total.
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }

  return copy;
}
