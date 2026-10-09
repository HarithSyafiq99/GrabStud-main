import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AppLoadingProvider } from "@/components/AppLoadingProvider";

const title = "GrabStudent · Good company. Better journeys.";
const description =
  "Book campus rides, review driver fares and travel with fellow students.";

export const metadata: Metadata = {
  metadataBase: new URL("https://grabstudent.vercel.app"),
  title,
  icons: { icon: "/favicon.svg" },
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "GrabStudent",
    type: "website",
    locale: "en_MY",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
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
