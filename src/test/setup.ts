import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no layout engine, so its `scrollTo` only emits a "Not implemented" error.
// The app calls it on every screen change; stubbing keeps test output honest.
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });

afterEach(() => {
  cleanup();
});
