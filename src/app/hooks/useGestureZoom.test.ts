import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGestureZoom } from "./useGestureZoom";

describe("useGestureZoom", () => {
  it("inicia con el zoom por defecto en 1 y showBadge en false", () => {
    const { result } = renderHook(() => useGestureZoom());
    expect(result.current.zoom).toBe(1);
    expect(result.current.showBadge).toBe(false);
  });

  it("permite configurar initialZoom, minZoom y maxZoom", () => {
    const { result } = renderHook(() =>
      useGestureZoom({ initialZoom: 1.5, minZoom: 0.5, maxZoom: 2 })
    );
    expect(result.current.zoom).toBe(1.5);
  });

  it("permite restablecer el zoom mediante resetZoom y activa showBadge", () => {
    const { result } = renderHook(() => useGestureZoom({ initialZoom: 1.5 }));

    act(() => {
      result.current.resetZoom(1);
    });

    expect(result.current.zoom).toBe(1);
    expect(result.current.showBadge).toBe(true);
  });

  it("reacciona a eventos de rueda con ctrlKey (gesto trackpad Chrome en Mac)", async () => {
    const div = document.createElement("div");
    const { result } = renderHook(() =>
      useGestureZoom({ containerRef: { current: div } })
    );

    await act(async () => {
      div.dispatchEvent(
        new WheelEvent("wheel", {
          ctrlKey: true,
          deltaY: -60,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(result.current.zoom).toBeGreaterThan(1);
  });

  it("reacciona a eventos de gestos WebKit (Safari en Mac)", async () => {
    const div = document.createElement("div");
    const { result } = renderHook(() =>
      useGestureZoom({ containerRef: { current: div } })
    );

    await act(async () => {
      div.dispatchEvent(new Event("gesturestart", { bubbles: true, cancelable: true }));

      const gestureChangeEvt = new Event("gesturechange", { bubbles: true, cancelable: true });
      Object.defineProperty(gestureChangeEvt, "scale", { value: 1.5 });
      div.dispatchEvent(gestureChangeEvt);
    });

    expect(result.current.zoom).toBeCloseTo(1.5, 1);
  });
});
