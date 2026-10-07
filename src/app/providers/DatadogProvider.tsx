'use client';

import { useEffect, type ReactNode } from 'react';
import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';

interface DatadogProviderProps {
  children?: ReactNode;
}

export function DatadogProvider({ children }: DatadogProviderProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (datadogRum.getInitConfiguration()) return;

    datadogRum.init({
      applicationId: '710f917a-0f76-4db2-bf1b-6d330eefea25',
      clientToken: 'pub239a3b2d8685687e70b1d432f2826018',
      site: 'datadoghq.com',
      service: 'b2car-frontend',
      env: process.env.NEXT_PUBLIC_DATADOG_ENV || process.env.NODE_ENV || 'production',
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 100,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      allowedTracingUrls: [
        {
          match: (url: string) =>
            url.startsWith('/api') ||
            (typeof window !== 'undefined' && url.includes(window.location.host)),
          propagatorTypes: ['datadog', 'tracecontext'],
        },
      ],
      plugins: [reactPlugin({ router: false })],
    });
  }, []);

  return <>{children}</>;
}
