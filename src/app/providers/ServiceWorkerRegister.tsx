// app/ServiceWorkerRegister.tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Solo registro en producción, opcional pero recomendado
    if (process.env.NODE_ENV !== 'production') return;

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker registrado:', registration);
      })
      .catch((error) => {
        console.error('Error registrando Service Worker:', error);
      });
  }, []);

  return null;
}
