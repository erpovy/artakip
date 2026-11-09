"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  LayoutDashboard,
  Globe,
  PlusCircle,
  Upload,
  AlertOctagon,
  Bell,
  User,
  CreditCard,
  ShieldAlert,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { useTheme } from "@/components/providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null);

  const user = session?.user as
    | { name?: string; email?: string; role?: string; plan?: string }
    | undefined;

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.impersonatedBy) setImpersonatedBy(d.impersonatedBy);
        else setImpersonatedBy(null);
      })
      .catch(() => null);
  }, [pathname]);

  async function exitImpersonation() {
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: null }),
    });
    setImpersonatedBy(null);
    router.push("/admin");
    router.refresh();
  }

  const navItems = [
    { href: "/dashboard", label: "Genel Bakış", icon: LayoutDashboard },
    { href: "/dashboard/monitors", label: "Sitelerim", icon: Globe },
    { href: "/dashboard/monitors/new", label: "Site Ekle", icon: PlusCircle },
    { href: "/dashboard/monitors/import", label: "Toplu CSV Yükle", icon: Upload },
    { href: "/dashboard/incidents", label: "Kesinti Olayları", icon: AlertOctagon },
    { href: "/dashboard/settings", label: "Bildirim Ayarları", icon: Bell },
    { href: "/dashboard/billing", label: "Plan & Faturalama", icon: CreditCard },
    { href: "/dashboard/account", label: "Hesabım", icon: User },
  ];

  if (user?.role === "ADMIN") {
    navItems.push({ href: "/admin", label: "Yönetici Paneli", icon: ShieldAlert });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobil Üst Çubuk */}
      <div className="md:hidden border-b bg-card px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <Activity className="h-5 w-5 text-primary" />
          <span>Artakip</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Yan Menü (Sidebar) */}
      <aside
        className={`${
          mobileOpen ? "block" : "hidden"
        } md:flex md:w-64 md:flex-col border-r bg-card shrink-0`}
      >
        <div className="h-16 px-6 hidden md:flex items-center justify-between border-b">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg">Artakip</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title="Koyu/Açık Tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-3">
          <div className="px-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold truncate">{user?.name || "Kullanıcı"}</p>
              <Badge variant="default">{user?.plan || "FREE"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 justify-start"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Ana İçerik */}
      <main className="flex-1 flex flex-col min-w-0">
        {impersonatedBy && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 px-4 py-2 text-xs flex items-center justify-between">
            <span>
              <strong>Yönetici Görünümü (Impersonation):</strong> Şu anda başka bir kullanıcının panelini görüntülüyorsunuz.
            </span>
            <Button size="sm" variant="outline" onClick={exitImpersonation}>
              Yönetici Hesabına Dön
            </Button>
          </div>
        )}
        <div className="p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
