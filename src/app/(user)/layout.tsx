"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/supabase/client";
import { routes } from "@/routing/routes";

function SidebarItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
        isActive
          ? "bg-[#007995] text-white"
          : "text-black hover:bg-gray-100"
      }`}
    >
      <span className="text-base font-medium">{label}</span>
    </Link>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      if (!session) {
        router.replace(routes.login);
      } else {
        setChecking(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace(routes.login);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">Cargando…</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f9] text-black">
      <header className="bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#007995] text-white">🔧</div>
            <div>
              <div className="text-lg font-semibold">TallerPro</div>
              <div className="text-xs text-gray-500">Sistema de Gestión</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace(routes.login);
            }}
            className="rounded-md bg-[#007995] px-3 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            Cerrar sesión
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-8 p-6">
        <aside className="w-64">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#007995] text-white">
                🔧
              </div>
              <div>
                <div className="text-xl font-semibold">TallerPro</div>
                <div className="text-sm text-gray-500">Sistema de Gestión</div>
              </div>
            </div>
            <nav className="space-y-2">
              <SidebarItem href={routes.clientes} label="Clientes" />
              <SidebarItem href={routes.vehiculos} label="Vehículos" />
            </nav>
          </div>
        </aside>
        <main className="flex-1">
          <div className="rounded-2xl bg-white p-6 shadow-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}


