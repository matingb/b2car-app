"use client";

import React from "react";
import Divider from "@/app/components/ui/Divider";
import SidebarItem from "./SidebarItem";
import { css } from "@emotion/react";
import { SidebarMenuKey, useSidebarMenu } from "@/app/hooks/useSidebarMenu";
import { useSheet } from "@/app/providers/SheetProvider";

export default function MenuSheet() {

  const { tenantName, items } = useSidebarMenu();
  const { closeSheet } = useSheet();

  return (
    <div css={styles.container}>
      <div css={styles.brand}>
        <span style={{ fontWeight: 700, fontSize: 24 }}>{tenantName}</span>
      </div>

      <nav css={styles.nav}>
        {items.map((item) => {
          const isLogout = item.key === SidebarMenuKey.Logout;
          const isClientes = item.key === SidebarMenuKey.Clientes;
          const isStock = item.key === SidebarMenuKey.Stock;
          return (
            <div key={item.key}>
              {isLogout || isClientes || isStock ? (
                <Divider
                  style={{
                    width: "100%",
                    marginBottom: "0.5rem",
                  }}
                />
              ) : null}
              <SidebarItem
                href={item.href}
                label={item.label}
                icon={item.icon}
                disabled={item.disabled}
                isLoading={item.isLoading}
                onClick={() => {
                  item.onClick?.();
                  closeSheet();
                }}
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
