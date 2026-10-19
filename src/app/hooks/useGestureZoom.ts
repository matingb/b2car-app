"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseGestureZoomOptions {
  /** Escala inicial (por defecto 1). */
  initialZoom?: number;
  /** Escala mínima permitida (por defecto 0.4). */
  minZoom?: number;
  /** Escala máxima permitida (por defecto 2.5). */
  maxZoom?: number;
  /** Referencia opcional al elemento contenedor. Si no se pasa, el hook crea una. */
  containerRef?: React.RefObject<HTMLElement | null>;
}

export interface UseGestureZoomReturn {
  zoom: number;
  showBadge: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  resetZoom: (target?: number) => void;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}

interface WebKitGestureEvent extends Event {
  scale: number;
}

const DEFAULT_MIN_ZOOM = 0.4;
const DEFAULT_MAX_ZOOM = 2.5;

export function useGestureZoom(options: UseGestureZoomOptions = {}): UseGestureZoomReturn {
  const {
    initialZoom = 1,
    minZoom = DEFAULT_MIN_ZOOM,
    maxZoom = DEFAULT_MAX_ZOOM,
    containerRef: externalContainerRef,
  } = options;

  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = (externalContainerRef ?? internalContainerRef) as React.RefObject<HTMLDivElement | null>;

  const [zoom, setZoom] = useState(initialZoom);
  const [showBadge, setShowBadge] = useState(false);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const badgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyZoomChange = useCallback(() => {
    setShowBadge(true);
    if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    badgeTimeoutRef.current = setTimeout(() => setShowBadge(false), 1500);
  }, []);

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(value, minZoom), maxZoom),
    [minZoom, maxZoom]
  );

  const resetZoom = useCallback(
    (target = 1) => {
      setZoom(clamp(target));
      notifyZoomChange();
    },
    [clamp, notifyZoomChange]
  );

  useEffect(() => {
    return () => {
      if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    };
  }, []);

  // Gestos de Zoom para Mac (Trackpad en Chrome y Safari) y Móviles (Pellizco táctil)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Chrome / Firefox / Edge en Mac: pellizco en trackpad emite wheel con ctrlKey
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.01;
        setZoom((prev) => clamp(prev + delta));
        notifyZoomChange();
      }
    };

    // 2. Safari en Mac: pellizco en trackpad emite gesturestart / gesturechange
    let gestureStartZoom = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStartZoom = zoomRef.current;
      notifyZoomChange();
    };

    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const gestureEvt = e as WebKitGestureEvent;
      if (typeof gestureEvt.scale === "number") {
        setZoom(clamp(gestureStartZoom * gestureEvt.scale));
        notifyZoomChange();
      }
    };

    // 3. Dispositivos móviles: pellizco táctil con 2 dedos
    let touchStartDist = 0;
    let touchStartZoom = 1;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartZoom = zoomRef.current;
        notifyZoomChange();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const nextZoom = clamp((currentDist / touchStartDist) * touchStartZoom);
        setZoom(nextZoom);
        notifyZoomChange();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        touchStartDist = 0;
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false });
    container.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("gesturestart", onGestureStart as EventListener);
      container.removeEventListener("gesturechange", onGestureChange as EventListener);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [clamp, containerRef, notifyZoomChange]);

  return {
    zoom,
    showBadge,
    containerRef,
    resetZoom,
    setZoom,
  };
}
