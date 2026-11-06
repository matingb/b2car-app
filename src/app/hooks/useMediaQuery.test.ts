import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaQuery, useIsTabletOrMobile } from "./useMediaQuery";
import { BREAKPOINTS } from "@/theme/theme";

describe("useMediaQuery", () => {
  let listeners: ((event: MediaQueryListEvent) => void)[] = [];
  let matchesValue = false;

  beforeEach(() => {
    listeners = [];
    matchesValue = false;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: matchesValue,
      media: query,
      onchange: null,
      addListener: vi.fn((cb) => listeners.push(cb)),
      removeListener: vi.fn((cb) => {
        listeners = listeners.filter((l) => l !== cb);
      }),
      addEventListener: vi.fn((_, cb) => listeners.push(cb)),
      removeEventListener: vi.fn((_, cb) => {
        listeners = listeners.filter((l) => l !== cb);
      }),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial match value", () => {
    matchesValue = true;
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(true);
  });

  it("updates when media query changes", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 768px)"));
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent));
    });

    expect(result.current).toBe(true);
  });

  it("useIsTabletOrMobile delegates with max-width breakpoint", () => {
    renderHook(() => useIsTabletOrMobile());
    expect(window.matchMedia).toHaveBeenCalledWith(`(max-width: ${BREAKPOINTS.lg}px)`);
  });
});

