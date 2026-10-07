'use client';

import { useEffect, type ReactNode } from 'react';
import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';

export function DatadogProvider({ children }: { children?: ReactNode }) {
  useEffect(() => {
    if (datadogRum.getInitConfiguration()) return;

    datadogRum.init({
      applicationId: '710f917a-0f76-4db2-bf1b-6d330eefea25',
      clientToken: 'pub239a3b2d8685687e70b1d432f2826018',
      site: 'datadoghq.com',
      service: 'b2car-frontend',
      env: process.env.NEXT_PUBLIC_DATADOG_ENV || 'production',
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 100,
      trackResources: true,
      trackUserInteractions: true,
      trackLongTasks: true,
      allowedTracingUrls: [
        {
          match: (url: string) => url.startsWith(window.location.origin),
          propagatorTypes: ['datadog', 'tracecontext'],
        },
      ],
      plugins: [reactPlugin({ router: false })],
    });
  }, []);

  return <>{children}</>;
}
