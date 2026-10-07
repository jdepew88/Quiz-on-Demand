import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, formatLimit } from "./formatTime";

describe("formatClock", () => {
  it("writes minutes and seconds, then hours once reached", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(5_000)).toBe("0:05");
    expect(formatClock(1_426_000)).toBe("23:46");
    expect(formatClock(3_798_000)).toBe("1:03:18");
    expect(formatClock(36_000_000)).toBe("10:00:00");
  });

  it("rounds elapsed time down and a countdown up", () => {
    expect(formatClock(59_999)).toBe("0:59");
    expect(formatClock(59_999, "remaining")).toBe("1:00");
    expect(formatClock(60_000, "remaining")).toBe("1:00");
    expect(formatClock(500, "remaining")).toBe("0:01");
    expect(formatClock(0, "remaining")).toBe("0:00");
  });

  it("never prints negative, NaN, infinite or missing values", () => {
    expect(formatClock(-1_000)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatClock(undefined)).toBe("0:00");
    expect(formatClock(null, "remaining")).toBe("0:00");
  });
});

describe("formatDuration", () => {
  it("uses seconds, then minutes, then hours", () => {
    expect(formatDuration(0)).toBe("0 sec");
    expect(formatDuration(42_000)).toBe("42 sec");
    expect(formatDuration(59_400)).toBe("59 sec");
    expect(formatDuration(59_600)).toBe("1m 00s");
    expect(formatDuration(78_000)).toBe("1m 18s");
    expect(formatDuration(126_000)).toBe("2m 06s");
    expect(formatDuration(3_840_000)).toBe("1h 04m");
    expect(formatDuration(7_200_000)).toBe("2h 00m");
  });

  it("guards against bad input", () => {
    expect(formatDuration(-5)).toBe("0 sec");
    expect(formatDuration(Number.NaN)).toBe("0 sec");
    expect(formatDuration(undefined)).toBe("0 sec");
  });
});

describe("formatLimit", () => {
  it("names presets the way they were chosen", () => {
    expect(formatLimit(15 * 60_000)).toBe("15 minutes");
    expect(formatLimit(60 * 60_000)).toBe("1 hour");
    expect(formatLimit(90 * 60_000)).toBe("90 minutes");
    expect(formatLimit(120 * 60_000)).toBe("2 hours");
    expect(formatLimit(60_000)).toBe("1 minute");
  });
});
