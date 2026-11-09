"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  LayoutDashboard,
  Globe,
  AlertTriangle,
  Bell,
  CreditCard,
  User,
  ShieldAlert,
  LogOut,
  PlusCircle,
  Upload,
  Sparkles,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    title: "İzleme Merkezi",
    items: [
      { href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard },
      { href: "/dashboard/monitors", label: "İzlenen Siteler", icon: Globe },
      { href: "/dashboard/monitors/new", label: "Yeni Site Ekle", icon: PlusCircle },
      { href: "/dashboard/monitors/import", label: "CSV İçe Aktar", icon: Upload },
    ],
  },
  {
    title: "Olaylar & Alarm",
    items: [
      { href: "/dashboard/incidents", label: "Kesinti Olayları", icon: AlertTriangle },
      { href: "/dashboard/settings", label: "Bildirim Ayarları", icon: Bell },
    ],
  },
  {
    title: "Hesap & Sistem",
    items: [
      { href: "/dashboard/billing", label: "Plan & Faturalama", icon: CreditCard },
      { href: "/dashboard/account", label: "Hesap Ayarları", icon: User },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sol Komuta Menüsü (Sidebar) */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border/70 bg-card/60 backdrop-blur-xl flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-5 flex items-center justify-between border-b border-border/60">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight block leading-none">
                  Artakip
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Uptime Command
                </span>
              </div>
            </Link>
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>

          {/* Sistem Canlılık Rozeti */}
          <div className="px-4 pt-4 pb-2 hidden md:block">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  İzleme Motoru Aktif
                </span>
              </div>
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </div>

          <nav className="p-3 space-y-5 overflow-x-auto md:overflow-visible">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75 hidden md:block">
                  {group.title}
                </p>
                <div className="flex md:flex-col gap-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap",
                          active
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {session?.user?.role === "ADMIN" && (
              <div className="pt-2 border-t border-border/60">
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all",
                    pathname.startsWith("/admin")
                      ? "bg-amber-500 text-white"
                      : "text-amber-500 hover:bg-amber-500/10"
                  )}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Yönetici Paneli</span>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* Kullanıcı Alt Kartı */}
        <div className="p-4 border-t border-border/60 hidden md:block space-y-3 bg-background/40">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate">
              <p className="text-xs font-bold truncate">
                {session?.user?.name || "Kullanıcı"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {session?.user?.email}
              </p>
            </div>
            <Badge variant="default" className="shrink-0">
              {session?.user?.plan || "FREE"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5" />
              Çıkış Yap
            </Button>
          </div>
        </div>
      </aside>

      {/* Sağ Ana İçerik Alanı */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Üst Hızlı Eylem Çubuğu */}
        <header className="h-16 border-b border-border/60 bg-background/70 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Komuta Merkezi</span>
            <span>/</span>
            <span className="truncate max-w-[200px] sm:max-w-none">
              {pathname === "/dashboard"
                ? "Genel Bakış"
                : pathname.includes("/monitors/new")
                ? "Yeni Site Ekle"
                : pathname.includes("/monitors/import")
                ? "CSV İçe Aktar"
                : pathname.includes("/monitors")
                ? "İzlenen Siteler"
                : pathname.includes("/incidents")
                ? "Kesinti Olayları"
                : pathname.includes("/settings")
                ? "Bildirim Ayarları"
                : pathname.includes("/billing")
                ? "Plan & Faturalama"
                : "Hesap Ayarları"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/dashboard/monitors/import" className="hidden sm:block">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" />
                CSV Yükle
              </Button>
            </Link>
            <Link href="/dashboard/monitors/new">
              <Button size="sm" className="gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" />
                Yeni Site Ekle
              </Button>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
