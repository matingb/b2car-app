import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";
import { Permission } from "./permissions";
import {
  fetchEffectivePermissions,
  queryEffectivePermissions,
  invalidatePermissionsCache,
  PERMISSIONS_CACHE_TAG,
  permissionsTag,
} from "./permissions.server";

vi.mock("server-only", () => ({}));

function createMockSupabase(options?: {
  rolePermissions?: string[];
  planPermissions?: string[];
  roleError?: Error | null;
  planError?: Error | null;
}) {
  const rolePerms = options?.rolePermissions ?? [
    Permission.DashboardView,
    Permission.ArreglosView,
    Permission.FinanzasView,
  ];
  const planPerms = options?.planPermissions ?? [
    Permission.DashboardView,
    Permission.ArreglosView,
  ];

  const fromMock = vi.fn((table: string) => {
    if (table === "role_permissions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: options?.roleError ? null : rolePerms.map((p) => ({ permission: p })),
              error: options?.roleError ?? null,
            }),
          }),
        }),
      };
    }
    if (table === "plan_permissions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: options?.planError ? null : planPerms.map((p) => ({ permission: p })),
              error: options?.planError ?? null,
            }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from: fromMock } as unknown as SupabaseClient,
    fromMock,
  };
}

describe("permissions.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("queryEffectivePermissions", () => {
    it("obtiene e intersecta permisos activos de rol y plan", async () => {
      const { supabase, fromMock } = createMockSupabase({
        rolePermissions: [Permission.DashboardView, Permission.ArreglosView, Permission.FinanzasView],
        planPermissions: [Permission.DashboardView, Permission.ArreglosView],
      });

      const perms = await queryEffectivePermissions(supabase, "admin", "PRO");

      expect(perms).toEqual([Permission.DashboardView, Permission.ArreglosView]);
      expect(fromMock).toHaveBeenCalledWith("role_permissions");
      expect(fromMock).toHaveBeenCalledWith("plan_permissions");
    });

    it("arroja error si la consulta a la BD falla", async () => {
      const { supabase } = createMockSupabase({
        roleError: new Error("DB connection error"),
      });

      await expect(
        queryEffectivePermissions(supabase, "admin", "PRO"),
      ).rejects.toThrow("DB connection error");
    });
  });

  describe("tags", () => {
    it("construye tags consistentes para revalidación de Next.js", () => {
      expect(PERMISSIONS_CACHE_TAG).toBe("permissions");
      expect(permissionsTag("admin", "PRO")).toBe("permissions:admin:PRO");
    });
  });

  describe("fetchEffectivePermissions", () => {
    it("invoca unstable_cache con la clave, revalidate y tags correspondientes", async () => {
      const { supabase } = createMockSupabase({
        rolePermissions: [Permission.DashboardView, Permission.OperacionesView],
        planPermissions: [Permission.DashboardView],
      });

      const perms = await fetchEffectivePermissions(supabase, "admin", "PRO");
      expect(perms).toEqual([Permission.DashboardView]);
      expect(unstable_cache).toHaveBeenCalledWith(
        expect.any(Function),
        ["effective-permissions", "admin", "PRO"],
        {
          revalidate: 3600,
          tags: ["permissions", "permissions:admin:PRO"],
        },
      );
    });
  });

  describe("invalidatePermissionsCache", () => {
    it("invalida el tag global cuando no se pasan argumentos", () => {
      invalidatePermissionsCache();
      expect(revalidateTag).toHaveBeenCalledWith("permissions");
    });

    it("invalida el tag específico cuando se especifican rol y plan", () => {
      invalidatePermissionsCache("admin", "PRO");
      expect(revalidateTag).toHaveBeenCalledWith("permissions:admin:PRO");
    });
  });
});
