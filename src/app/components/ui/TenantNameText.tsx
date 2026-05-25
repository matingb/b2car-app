"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

type TenantNameTextProps = {
  name: string;
  maxFontSize?: number;
  minFontSize?: number;
  fontWeight?: number;
  style?: CSSProperties;
};

export default function TenantNameText({
  name,
  maxFontSize = 20,
  minFontSize = 10,
  fontWeight = 600,
  style,
}: TenantNameTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  const fitText = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const availableWidth = container.clientWidth;
    if (availableWidth <= 0) return;

    const currentFontSize = Number.parseFloat(getComputedStyle(text).fontSize);
    const measuredWidth = text.scrollWidth;
    if (measuredWidth <= 0 || currentFontSize <= 0) return;

    const nextFontSize = Math.max(
      minFontSize,
      Math.min(maxFontSize, (currentFontSize * availableWidth) / measuredWidth)
    );

    setFontSize((current) =>
      Math.abs(current - nextFontSize) > 0.25 ? nextFontSize : current
    );
  }, [maxFontSize, minFontSize]);

  useLayoutEffect(() => {
    setFontSize(maxFontSize);
  }, [maxFontSize, name]);

  useLayoutEffect(() => {
    fitText();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(fitText);
    observer.observe(container);

    void document.fonts?.ready.then(fitText);

    return () => observer.disconnect();
  }, [fitText, name]);

  useLayoutEffect(() => {
    fitText();
  }, [fitText, fontSize]);

  return (
    <div
      ref={containerRef}
      title={name}
      style={{
        minWidth: 0,
        width: "100%",
        overflow: "hidden",
        marginLeft: 0.25,
        ...style,
      }}
    >
      <span
        ref={textRef}
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          fontSize,
          lineHeight: 1.2,
          fontWeight,
        }}
      >
        {name}
      </span>
    </div>
  );
}
