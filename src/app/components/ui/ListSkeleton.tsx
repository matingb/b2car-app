"use client";

import React from "react";
import { Skeleton, Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { BREAKPOINTS } from "@/theme/theme";
import { css } from "@emotion/react";

type Props = {
  rows?: number;
};

export default function ListSkeleton({ rows = 6 }: Props) {
  return (
    <Theme>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={styles.card}>
            <div style={styles.row}>
              <div style={styles.left}>
                <Skeleton style={{ width: '44px', height: 40, borderRadius: 9999 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  <Skeleton style={{ width: 120, height: 16 }} />
                  <div style={{ }} css={styles.dataList}>
                    <Skeleton style={{ width: 140, height: 12 }} />
                    <Skeleton style={{ width: 120, height: 12 }} />
                    <Skeleton style={{ width: 120, height: 12 }} />
                  </div>
                </div>
              </div>
                <Skeleton style={{ width: 72, height: 28, borderRadius: 8, marginRight: 12 }} />
              <div css={styles.dataList}>
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
                <Skeleton style={{ width: 28, height: 28, borderRadius: 6 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Theme>
  );
}

const styles = {
  card: {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  dataList: css({
    display: "flex", 
    gap: 8,
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: 'none',
    },
  })
} as const;
