"use client";

import React from "react";
import { ArrowLeft, ChevronRight, Menu } from "lucide-react";
import { BREAKPOINTS, COLOR } from "@/theme/theme";
import { useRouter } from "next/navigation";
import Button from "./Button";
import { css } from "@emotion/react";
import { useSheet } from "@/app/providers/SheetProvider";
import MenuSheet from "./MenuSheet";


interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  className?: string;
  hasBackButton?: boolean;
  style?: React.CSSProperties;
}

export default function ScreenHeader({
  title,
  subtitle,
  breadcrumbs = [],
  className,
  hasBackButton = false,
  style,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { openSheet } = useSheet();

  const handleOpenMenu = () => {
    openSheet({
      content: <MenuSheet />,
      side: "left",
    });
  };

  return (
    <header className={className} style={{ ...styles.header, ...style }}>
      <div style={styles.titleWrapper}>
        {hasBackButton && (
          <ArrowLeft
            size={20}
            color={COLOR.ICON.MUTED}
            onClick={() => router.back()}
            style={{ cursor: "pointer" }}
          />
        )}

        <div style={styles.titleBlock}>
          <h1 style={styles.title}>{title}</h1>
          {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}
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
      <Button icon={<Menu size={20} />} text="" onClick={handleOpenMenu} css={styles.menuBtn} />
    </header>
  );
}

const styles = {
  menuBtn: css({
    display: "none",
    height: '40px',
    [`@media (max-width: ${BREAKPOINTS.md}px)`]: {
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
  titleBlock: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  title: {
    margin: 0,
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    color: COLOR.TEXT.SECONDARY,
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
