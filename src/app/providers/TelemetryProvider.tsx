'use client';

import { useEffect, type ReactNode } from 'react';
import { telemetry } from '@/lib/telemetry';

export function TelemetryProvider({ children }: { children?: ReactNode }) {
  useEffect(() => {
    telemetry.initClient();
  }, []);

  return <>{children}</>;
}

