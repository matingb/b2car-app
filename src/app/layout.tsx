"use client";
import "../globals.css";
import { Open_Sans } from "next/font/google";

const openSans = Open_Sans({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="manifest.json"></link>
      </head>
      <body className={openSans.className}>
        {children}
      </body>
    </html>
  );
}
