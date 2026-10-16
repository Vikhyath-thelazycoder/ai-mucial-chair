import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusGuard } from "./useFocusGuard";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: hidden ? "hidden" : "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useFocusGuard", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setHidden(false);
  });

  it("reports leaving and returning with the time away, once per absence", () => {
    const report = vi.fn();
    const { result } = renderHook(() => useFocusGuard({ active: true, onReport: report }));

    act(() => {
      setHidden(true);
      window.dispatchEvent(new Event("blur")); // same absence: must not double-report
    });
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenLastCalledWith("away_start", undefined);
    expect(result.current.warning).toBe(true);

    act(() => {
      vi.advanceTimersByTime(6200);
      setHidden(false);
      window.dispatchEvent(new Event("focus"));
    });
    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenLastCalledWith("away_end", 6200);
  });

  it("does nothing while not answering", () => {
    const report = vi.fn();
    renderHook(() => useFocusGuard({ active: false, onReport: report }));
    act(() => setHidden(true));
    expect(report).not.toHaveBeenCalled();
  });

  it("blocks copy, cut, paste and the context menu while answering", () => {
    renderHook(() => useFocusGuard({ active: true, onReport: () => {} }));
    for (const type of ["copy", "cut", "paste", "contextmenu", "selectstart"]) {
      const e = new Event(type, { cancelable: true, bubbles: true });
      document.body.dispatchEvent(e);
      expect(e.defaultPrevented, type).toBe(true);
    }
  });

  it("dismissing the warning hides it", () => {
    const { result } = renderHook(() => useFocusGuard({ active: true, onReport: () => {} }));
    act(() => setHidden(true));
    act(() => {
      setHidden(false);
      window.dispatchEvent(new Event("focus"));
    });
    act(() => result.current.dismiss());
    expect(result.current.warning).toBe(false);
  });
});
