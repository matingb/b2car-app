"use client";

import React from "react";
import { useTenant } from "@/app/providers/TenantProvider";
import type { PermissionValue } from "@/lib/permissions";

type CanProps = {
  permission?: PermissionValue | PermissionValue[];
  anyPermissions?: PermissionValue[];
  path?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function Can({
  permission,
  anyPermissions,
  path,
  children,
  fallback = null,
}: CanProps) {
  const tenant = useTenant();

  let allowed = true;
  if (path) {
    allowed = allowed && tenant.canAccessPath(path);
  }

  if (permission) {
    if (Array.isArray(permission)) {
      allowed = allowed && permission.every((p) => tenant.hasPermission(p));
    } else {
      allowed = allowed && tenant.hasPermission(permission);
    }
  }

  if (anyPermissions) {
    allowed = allowed && anyPermissions.some((p) => tenant.hasPermission(p));
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
