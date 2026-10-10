import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal Frames — House Design Studio",
  description: "Design a gable-roof home with custom dimensions and colors, explore its 3D model, and review live framing quantities and itemized material costs.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/universal-frames-icon.png",
    shortcut: "/brand/universal-frames-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
