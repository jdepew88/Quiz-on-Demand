import { describe, expect, it } from "vitest";
import { shuffle } from "./shuffle";

/** Feeds a fixed sequence of "random" values, cycling if the shuffle asks for more. */
function sequenceRng(values: number[]): () => number {
  let cursor = 0;
  return () => {
    const value = values[cursor % values.length] ?? 0;
    cursor += 1;
    return value;
  };
}

describe("shuffle", () => {
  it("does not mutate the input array", () => {
    const source = [1, 2, 3, 4, 5];
    const snapshot = [...source];
    shuffle(source);
    expect(source).toEqual(snapshot);
  });

  it("returns a new array, not the same reference", () => {
    const source = [1, 2, 3];
    expect(shuffle(source)).not.toBe(source);
  });

  it("preserves every element exactly once", () => {
    const source = Array.from({ length: 60 }, (_, index) => index);
    const shuffled = shuffle(source);
    expect(shuffled).toHaveLength(source.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["only"])).toEqual(["only"]);
  });

  it("reverses the array when the rng always picks index 0", () => {
    // Fisher-Yates walks i from the end and swaps with j = floor(rng * (i+1)).
    // rng() === 0 means j === 0 every time, which rotates the array in a fully
    // predictable way — a direct check that the algorithm is the real thing.
    expect(shuffle([1, 2, 3, 4], sequenceRng([0]))).toEqual([2, 3, 4, 1]);
  });

  it("is the identity permutation when the rng always picks the current index", () => {
    // rng() just under 1 makes j === i, so every swap is a no-op.
    const source = ["a", "b", "c", "d", "e"];
    expect(shuffle(source, sequenceRng([0.999999]))).toEqual(source);
  });

  it("never produces an out-of-range index for rng values approaching 1", () => {
    const source = Array.from({ length: 25 }, (_, index) => index);
    const shuffled = shuffle(source, sequenceRng([0.9999999999]));
    expect(shuffled).not.toContain(undefined);
    expect(shuffled).toHaveLength(25);
  });

  it("is unbiased: every permutation of three elements appears over many runs", () => {
    const counts = new Map<string, number>();
    const runs = 30_000;

    for (let run = 0; run < runs; run++) {
      const key = shuffle(["a", "b", "c"]).join("");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    expect(counts.size).toBe(6);

    // A uniform shuffle gives each of the 6 permutations runs/6 ≈ 5000. A generous ±25%
    // band keeps the test meaningful without making it flaky; `sort(() => Math.random() -
    // 0.5)` fails this comfortably.
    const expected = runs / 6;
    for (const [permutation, count] of counts) {
      expect(count, `permutation ${permutation} appeared ${count} times`).toBeGreaterThan(
        expected * 0.75,
      );
      expect(count, `permutation ${permutation} appeared ${count} times`).toBeLessThan(
        expected * 1.25,
      );
    }
  });
});
