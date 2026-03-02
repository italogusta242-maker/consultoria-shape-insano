import { Outlet, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, Activity, HeartHandshake, MessageSquare,
  ChevronLeft, Menu, LogOut,
} from "lucide-react";
import { useState } from "react";
import InsanoLogo from "@/components/InsanoLogo";
import SidebarProfile from "@/components/SidebarProfile";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { title: "Dashboard", path: "/cs", icon: LayoutDashboard },
  { title: "Chat", path: "/cs/chat", icon: MessageSquare },
  { title: "Alunos", path: "/cs/alunos", icon: Users },
  { title: "Profissionais", path: "/cs/profissionais", icon: Activity },
  { title: "Retenção", path: "/cs/retencao", icon: HeartHandshake },
];

const CSLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/cs") return location.pathname === "/cs";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <InsanoLogo size={28} />
              <span className="font-cinzel text-sm font-bold text-gold">SUCESSO</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground"
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                isActive(item.path)
                  ? "bg-primary/20 text-gold font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <item.icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-3">
          <SidebarProfile collapsed={collapsed} />
          <button
            onClick={() => signOut()}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors w-full",
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default CSLayout;
