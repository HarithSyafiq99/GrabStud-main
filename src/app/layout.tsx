import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrabStudent · Good company. Better journeys.",
  icons: { icon: "/favicon.svg" },
  description: "University carpool matching with petrol-sharing rates",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
