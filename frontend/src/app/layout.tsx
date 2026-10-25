import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

// The UI text is Manrope (self-hosted, see styles/tokens.css); mono is kept
// for ids, timestamps and code.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Qodirjon Office",
  description:
    "Real-time pixel art visualization of Claude Code operations in a virtual office",
};

// viewport-fit=cover lets the page run under the iPhone's notch and home
// indicator; the bars keep clear of them with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080d0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
