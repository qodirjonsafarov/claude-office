import type { Metadata } from "next";
import { Geist, Geist_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// Pixel display font for HUD titles, tabs and buttons
const pixelify = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Qodirjon Office",
  description:
    "Real-time pixel art visualization of Claude Code operations in a virtual office",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pixelify.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
