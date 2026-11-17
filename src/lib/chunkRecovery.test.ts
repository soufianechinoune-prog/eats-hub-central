import { describe, expect, it, vi, afterEach } from "vitest";
import { isRecoverableModuleError, isRouterContextError, reloadOnceForChunkError } from "./chunkRecovery";

describe("stale router module recovery", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("recognizes the reported lazy-page router error", () => {
    expect(isRecoverableModuleError(new Error("useNavigate() may be used only in the context of a <Router> component."))).toBe(true);
    expect(isRouterContextError('Error: useNavigate() may be used only in the context of a <Router> component.')).toBe(true);
  });

  it("does not treat unrelated application errors as recoverable", () => {
    expect(isRecoverableModuleError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("reloads only once on a route to prevent persistent errors looping", () => {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/analytics/ads-spend", search: "", reload } });
    expect(reloadOnceForChunkError()).toBe(true);
    expect(reloadOnceForChunkError()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});