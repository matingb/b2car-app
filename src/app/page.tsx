"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { useRouter } from "next/navigation";
import { routes } from "@/routing/routes";

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUserEmail(data.user?.email ?? null);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold">Welcome</h1>
      {userEmail && (
        <>
          <p className="mt-2 text-gray-600">You are logged in as {userEmail}</p>
          <button
            onClick={async () => {
              setIsSigningOut(true);
              try {
                await supabase.auth.signOut();
                router.push(routes.login);
              } finally {
                setIsSigningOut(false);
              }
            }}
            disabled={isSigningOut}
            className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </>
      )}
    </main>
  );
}


