"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Divider from "@/app/components/ui/Divider";
import { Users, Car, Wrench, LogOut, ChartNoAxesCombined } from "lucide-react";
import SidebarItem from "./SidebarItem";
import { ROUTES } from "@/routing/routes";
import { logOut } from "@/app/login/actions";
import { useSheet } from "@/app/providers/SheetProvider";
import { css } from "@emotion/react";

export default function MenuSheet() {
  const [tenantName, setTenantName] = useState("B2Car");
  const { closeSheet } = useSheet();
  const router = useRouter();

  const handleNavClick = () => closeSheet();
  const handleLogout = async () => {
    closeSheet();
    await logOut();
    router.push("/login");
  };

  useEffect(() => {
      try {
        const stored = localStorage.getItem("tenant_name");
        const next = stored?.trim();
        if (next) setTenantName(next);
      } catch {
        // ignore (e.g. blocked storage)
      }
    }, []);

  return (
    <div css={styles.container}>
      <div css={styles.brand}>
        <span style={{ fontWeight: 700, fontSize: 24 }}>{tenantName}</span>
      </div>

      <nav css={styles.nav}>
        <SidebarItem
          href={ROUTES.dashboard}
          label="Dashboard"
          icon={<ChartNoAxesCombined size={18} />}
          onClick={handleNavClick}
        />
        <SidebarItem
          href={ROUTES.clientes}
          label="Clientes"
          icon={<Users size={18} />}
          onClick={handleNavClick}
        />
        <SidebarItem
          href={ROUTES.vehiculos}
          label="Vehiculos"
          icon={<Car size={18} />}
          onClick={handleNavClick}
        />
        <SidebarItem
          href={ROUTES.arreglos}
          label="Arreglos"
          icon={<Wrench size={18} />}
          onClick={handleNavClick}
        />

        <Divider
          style={{ margin: "8px 0" }}
        />

        <SidebarItem
          href={""}
          label="Cerrar sesión"
          icon={<LogOut size={18} />}
          onClick={handleLogout}
        />
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
