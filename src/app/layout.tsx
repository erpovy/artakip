import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Artakip — Web Sitesi Uptime & Kesinti Takip SaaS",
  description:
    "300+ WordPress ve kurumsal web sitesinin ne zaman kapandığını ve ne zaman açıldığını 7/24 izleyen SaaS platformu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
