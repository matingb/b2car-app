"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
import { ROUTES } from "@/routing/routes";

type SessionProviderValue = {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionProviderValue | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (!session) router.replace(ROUTES.login);
      if (session && typeof window !== "undefined") {
        const isOnLogin = window.location.pathname === ROUTES.login;
        if (isOnLogin) router.replace(ROUTES.root);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace(ROUTES.login);
      if (session && typeof window !== "undefined") {
        const isOnLogin = window.location.pathname === ROUTES.login;
        if (isOnLogin) router.replace(ROUTES.root);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase.auth,router ]);

  const signIn = useCallback(async (email: string, password: string) => {
    await supabase.auth.signInWithPassword({ email, password });
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace(ROUTES.login);
  }, [supabase.auth, router]);

  const value: SessionProviderValue = useMemo(
    () => ({
      signIn,
      signOut,
    }),
    [signIn, signOut]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
