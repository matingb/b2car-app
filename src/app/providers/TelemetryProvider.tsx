'use client';

import { type ReactNode } from 'react';
import { DatadogProvider } from './DatadogProvider';
import { HoneycombProvider } from './HoneycombProvider';


export function TelemetryProvider({ children }: { children?: ReactNode }) {
  return (
    <DatadogProvider>
      <HoneycombProvider>
        {children}
      </HoneycombProvider>
    </DatadogProvider>
  );
}
