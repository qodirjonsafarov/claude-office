import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { THEME_BOOT_SCRIPT, THEME_COLORS } from "@/systems/theme";

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
  // iPhone "Add to Home Screen": standalone app. Its localStorage (the API
  // token) is separate from Safari, so the token prompt shows once there.
  appleWebApp: {
    capable: true,
    title: "Office",
    statusBarStyle: "black-translucent",
  },
};

// viewport-fit=cover lets the page run under the iPhone's notch and home
// indicator; the bars keep clear of them with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The page colour of each theme (--qo-bg). The OS theme picks one before
  // any script runs; an explicit choice rewrites both (systems/themeStore.ts).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The boot script sets data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
