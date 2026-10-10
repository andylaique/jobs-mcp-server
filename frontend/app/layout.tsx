import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jobs MCP · Gemini Chat",
  description: "Chat with Gemini about job postings via MCP-style tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
