"use client";

import React from "react";
import Divider from "@/app/components/ui/Divider";
import SidebarItem from "./SidebarItem";
import { css } from "@emotion/react";
import { SidebarMenuKey, useSidebarMenu } from "@/app/hooks/useSidebarMenu";

export default function MenuSheet() {

  const { tenantName, items } = useSidebarMenu();

  return (
    <div css={styles.container}>
      <div css={styles.brand}>
        <span style={{ fontWeight: 700, fontSize: 24 }}>{tenantName}</span>
      </div>

      <nav css={styles.nav}>
        {items.map((item) => {
          const isLogout = item.key === SidebarMenuKey.Logout;
          return (
            <div key={item.key}>
              {isLogout ? <Divider style={{ margin: "8px 0" }} /> : null}
              <SidebarItem
                href={item.href}
                label={item.label}
                icon={item.icon}
                disabled={item.disabled}
                isLoading={item.isLoading}
                onClick={item.onClick}
              />
            </div>
          );
        })}
      </nav>
    </div>
  );
}

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  }),
  brand: css({
    display: "flex",
    flexDirection: "column",
    gap: 4,
    paddingInline: "0.25rem",
  }),
  nav: css({
    display: "flex",
    width: "90%",
    flexDirection: "column",
    rowGap: 8,
  }),
} as const;
