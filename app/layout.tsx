import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grading helper | Create your Excel workbook",
  description: "Turn a two-level rubric into an Excel grading workbook for 100 students, with weighted scores and automatic totals.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
