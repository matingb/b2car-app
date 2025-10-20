"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLOR } from "@/theme/theme";
import { ReactNode, useMemo } from "react";

export default function SidebarItem({
  href,
  label,
  icon,
  collapsed = false,
  onClick = () => {},
}: {
  href: string;
  label: string;
  icon?: ReactNode;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname.includes(href) && href !== ''; 

  const s = useMemo(() => {
    return {
      item: {
        display: "flex",
        alignItems: "center",
        columnGap: collapsed ? "0" : "0.75rem",
        borderRadius: "0.75rem",
        padding: "0.5rem 0.5rem",
        color: COLOR.TEXT.PRIMARY,
        justifyContent: collapsed ? "flex-start" : "flex-start",
        width: "100%",
        textDecoration: "none",
        transition: "background-color 150ms ease, color 150ms ease, padding 150ms ease",
      } as React.CSSProperties,
      itemActive: {
        backgroundColor: COLOR.ACCENT.PRIMARY,
        color: COLOR.TEXT.CONTRAST,
      } as React.CSSProperties,
      iconWrap: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "1.5rem",
        width: "3rem",
      } as React.CSSProperties,
      itemLabel: {
        fontSize: "1rem",
        lineHeight: "1.5rem",
        fontWeight: 500,
        display: collapsed ? "none" : "inline",
        whiteSpace: "nowrap",
        overflow: "hidden",
        
      } as React.CSSProperties,
    };
  }, [collapsed]);

  return (
    <Link
      href={href}
      style={{ ...s.item, ...(isActive ? s.itemActive : null) }}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon ? <span style={s.iconWrap}>{icon}</span> : null}
      <span style={s.itemLabel}>{label}</span>
    </Link>
  );
}
