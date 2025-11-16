import React from "react";
import { ChevronRight } from "lucide-react";
import { COLOR } from "@/theme/theme";

interface ScreenHeaderProps {
  title: string;
  breadcrumbs?: string[];
  className?: string;
}

export default function ScreenHeader({
  title,
  breadcrumbs = [],
  className,
}: ScreenHeaderProps) {
  return (
    <header className={className} style={styles.header}>
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
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "start",
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
