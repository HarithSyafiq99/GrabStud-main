import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppLoadingProvider } from "@/components/AppLoadingProvider";

export const metadata: Metadata = {
  title: "GrabStudent · Good company. Better journeys.",
  icons: { icon: "/favicon.svg" },
  description: "University carpool matching with petrol-sharing rates",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7954bf",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppLoadingProvider>{children}</AppLoadingProvider>
      </body>
    </html>
  );
}
