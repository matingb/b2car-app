"use client";
import "../globals.css";
import { Rubik, Roboto, Open_Sans } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"] });
const roboto = Roboto({ subsets: ["latin"] });
const openSans = Open_Sans({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      
      <body className={openSans.className}>
        {children}
      </body>
    </html>
  );
}
