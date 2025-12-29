import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MovieMind - AI Recommendations", // ✅ Fixed Title
  description: "Intelligent Movie Recommender System",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}