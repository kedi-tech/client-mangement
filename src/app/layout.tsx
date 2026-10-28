import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { readTheme } from "@/lib/theme";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KediClient",
    template: "%s · KediClient",
  },
  description:
    "Track clients, contacts, projects, tasks and invoices in one workspace.",
  // Private client data behind a login: keep it out of search results.
  robots: { index: false, follow: false, nocache: true },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await readTheme();
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}${theme === "dark" ? " dark" : ""}`}
    >
      <body>{children}</body>
    </html>
  );
}
