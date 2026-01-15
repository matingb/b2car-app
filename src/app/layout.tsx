import "../globals.css";
import { ServiceWorkerRegister } from "./providers/ServiceWorkerRegister";
import ToastProvider from "./providers/ToastProvider";
import { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content"></meta>
      <head>
      </head>
      <body>
        <ToastProvider>
          <ServiceWorkerRegister />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
