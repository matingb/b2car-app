"use client";

import React from "react";
import { ArrowLeft, ChevronRight, Menu } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useRouter } from "next/navigation";
import Button from "./Button";
import { css } from "@emotion/react";


interface ScreenHeaderProps {
  title: string;
  breadcrumbs?: string[];
  className?: string;
  hasBackButton?: boolean;
}

export default function ScreenHeader({
  title,
  breadcrumbs = [],
  className,
  hasBackButton = false
}: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <header className={className} style={styles.header}>
      <div style={styles.titleWrapper}>
      {hasBackButton && (
        <ArrowLeft
          size={20}
          color={COLOR.ICON.MUTED}
          onClick={() => router.back()}
          style={{ cursor: "pointer" }}
        />
      )}
      <div style={styles.titleWrapper}>
        <h1>{title}</h1>
      </div>

      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" style={styles.nav}>
          <ol style={styles.ol}>
            {breadcrumbs.map((crumb, idx) => {
              return (
                <li key={idx} style={styles.li}>
                  {idx !== 0 && <ChevronRight size={16} />}
                  <span style={{ ...styles.span, color: COLOR.ICON.MUTED }}>
                    {crumb}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      </div>
      <Button icon={<Menu size={20} />} text="" css={styles.menuBtn} />
    </header>
  );
}

const styles = {
  menuBtn: css({
    display: "none",
    height: '40px',
    [`@media (max-width: ${BREAKPOINTS.sm}px)`]: {
      display: "flex",
    },
  }),
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  titleWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  nav: {
    display: "flex",
    alignItems: "center",
  },
  ol: {
    display: "flex",
    alignItems: "center",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  li: {
    display: "flex",
    alignItems: "center",
    color: COLOR.TEXT.SECONDARY,
    fontSize: 14,
  },
  span: {
    fontWeight: 400,
    marginInline: 4,
  },
  icon: {
    color: COLOR.ICON.MUTED,
  },
} as const;
