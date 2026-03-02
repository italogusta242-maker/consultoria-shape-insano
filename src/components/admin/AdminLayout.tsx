import { Outlet, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardEdit,
  UserCog,
  BarChart3,
  MessageSquare,
  ChevronLeft,
  Menu,
  UserPlus,
  ShieldCheck,
  
  
  Briefcase,
} from "lucide-react";
import { useState } from "react";
import InsanoLogo from "@/components/InsanoLogo";
import AdminPresenceOverlay from "@/components/admin/AdminPresenceOverlay";
import SidebarProfile from "@/components/SidebarProfile";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

const navItems = [
  { title: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { title: "Usuários", path: "/admin/usuarios", icon: Users },
  { title: "Importar Alunos", path: "/admin/importar", icon: UserPlus },
  { title: "Permissões", path: "/admin/permissoes", icon: ShieldCheck },
  
  { title: "Especialistas", path: "/admin/especialistas", icon: UserCog },
  { title: "Closers", path: "/admin/closers", icon: Briefcase },
  { title: "Comunicação", path: "/admin/comunicacao", icon: MessageSquare },
  { title: "Anamneses", path: "/admin/anamneses", icon: ClipboardEdit },
  
  { title: "Relatórios", path: "/admin/relatorios", icon: BarChart3 },
];

const AdminLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AdminPresenceOverlay />
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-sidebar transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <InsanoLogo size={28} />
              <span className="font-cinzel text-sm font-bold text-gold">QUARTEL GENERAL</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground"
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Nav */}
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

        {/* Footer with profile */}
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

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        <div className="p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
