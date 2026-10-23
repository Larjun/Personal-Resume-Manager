import type { Metadata } from "next";
// Self-hosted resume fonts (template typography depends on these exact files).
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/700.css";
import "@fontsource/arimo/400.css";
import "@fontsource/arimo/400-italic.css";
import "@fontsource/arimo/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Manager",
  description: "Build and maintain resumes with a print-accurate preview.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
