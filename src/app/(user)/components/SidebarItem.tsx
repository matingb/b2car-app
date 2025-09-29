"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCENT_PRIMARY, TEXT_CONTRAST, TEXT_PRIMARY } from "@/theme/theme";

export default function SidebarItem({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link href={href} style={{ ...styles.item, ...isActive && styles.itemActive }}>
      <span style={styles.itemLabel}>{label}</span>
    </Link>
  );
}

const styles = {
  item: {
    display: "flex",
    alignItems: "center",
    columnGap: "0.75rem",
    borderRadius: "0.75rem",
    padding: "0.75rem 1rem",
    color: TEXT_PRIMARY,
  },
  itemActive: {
    backgroundColor: ACCENT_PRIMARY,
    color: TEXT_CONTRAST,
  },
  itemLabel: {
    fontSize: "1rem",
    lineHeight: "1.5rem",
    fontWeight: 500,
  },
}
