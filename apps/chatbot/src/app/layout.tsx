import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { PwaSetup } from "@/components/pwa/pwa-setup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panel · CI Quality Group",
  description: "Panel de administración del asistente de CI Quality Group.",
  applicationName: "CQG Panel",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "CQG Panel" },
  formatDetection: { telephone: false },
};

// theme-color + viewport-fit=cover (notch/safe-areas) + ancho del dispositivo.
export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          {children}
          <PwaSetup />
        </body>
      </html>
    </ClerkProvider>
  );
}
