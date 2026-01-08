import "../globals.css";
import { Open_Sans } from "next/font/google";
import { ServiceWorkerRegister } from "./providers/ServiceWorkerRegister";
import ToastProvider from "./providers/ToastProvider";
import { Metadata } from "next";

const openSans = Open_Sans({ subsets: ["latin"] });
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
      <body className={openSans.className}>
        <ToastProvider>
          <ServiceWorkerRegister />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
