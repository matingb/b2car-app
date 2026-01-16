"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLOR } from "@/theme/theme";
import { ReactNode, useMemo } from "react";
import { LoaderCircle } from "lucide-react";

export default function SidebarItem({
  href,
  label,
  icon,
  collapsed = false,
  disabled = false,
  isLoading = false,
  onClick = () => {},
}: {
  href: string;
  label: string;
  icon?: ReactNode;
  collapsed?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
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
        padding: "0.5rem 0rem",
        color: COLOR.TEXT.PRIMARY,
        justifyContent: collapsed ? "flex-start" : "flex-start",
        width: "100%",
        textDecoration: "none",
        //transition: "background-color 150ms ease, color 150ms ease, padding 150ms ease",
        transition: "all 0.2s ease-in-out"
      } as React.CSSProperties,
      itemActive: {
        backgroundColor: COLOR.ACCENT.PRIMARY,
        color: COLOR.TEXT.CONTRAST,
      } as React.CSSProperties,
      itemDisabled: {
        opacity: 0.6,
        cursor: "not-allowed",
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

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // For action items (e.g. logout) we keep href empty and prevent navigation.
    if (!href) e.preventDefault();
    onClick?.();
  };

  return (
    <Link
      href={href}
      className={`sidebar-item ${isActive ? "active" : ""}`}
      style={{
        ...s.item,
        ...(isActive ? s.itemActive : null),
        ...(disabled || isLoading ? s.itemDisabled : null),
      }}
      aria-label={label}
      title={label}
      aria-disabled={disabled || isLoading}
      tabIndex={disabled || isLoading ? -1 : 0}
      onClick={handleClick}
    >
      <span style={s.iconWrap}>
        {isLoading ? (
          <LoaderCircle
            data-testid="sidebar-item-spinner"
            className="animate-spin"
            size={18}
          />
        ) : icon ? (
          icon
        ) : null}
      </span>
      <span style={s.itemLabel}>{label}</span>
    </Link>
  );
}
