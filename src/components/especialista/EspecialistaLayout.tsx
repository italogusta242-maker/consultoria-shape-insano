import { Outlet, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, MessageSquare, UserCog, ChevronLeft, Menu,
  Dumbbell, Apple, UtensilsCrossed, BookOpen, X, Brain,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import InsanoLogo from "@/components/InsanoLogo";
import NotificationBell from "@/components/especialista/NotificationBell";
import { cn } from "@/lib/utils";
import { useSpecialistStudents } from "@/hooks/useSpecialistStudents";
import { useAllowedRoutes } from "@/hooks/useSpecialtyGuard";

const SPECIALTY_NAV: Record<string, { title: string; path: string; icon: typeof Dumbbell }[]> = {
  personal: [],
  nutricionista: [],
};

const SPECIALTY_EXTRA_NAV: Record<string, { title: string; path: string; icon: typeof Dumbbell }[]> = {
  personal: [{ title: "Base de Exercícios", path: "/especialista/exercicios", icon: BookOpen }],
  nutricionista: [{ title: "Alimentos", path: "/especialista/alimentos", icon: UtensilsCrossed }],
};

const EspecialistaLayout = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: students } = useSpecialistStudents();
  const { specialty, rawSpecialty } = useAllowedRoutes();

  const studentCount = students?.length ?? 0;

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Swipe gesture to open sidebar on mobile
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Swipe right from left edge to open
    if (deltaX > 80 && deltaY < 60 && touchStartX.current < 40 && !mobileOpen) {
      setMobileOpen(true);
    }
    // Swipe left to close
    if (deltaX < -80 && deltaY < 60 && mobileOpen) {
      setMobileOpen(false);
    }
  }, [mobileOpen]);

  // Build nav
  const navItems: { title: string; path: string; icon: typeof LayoutDashboard; badge: string | null }[] = [
    { title: "Dashboard", path: "/especialista", icon: LayoutDashboard, badge: null },
    { title: "Meus Alunos", path: "/especialista/alunos", icon: Users, badge: studentCount > 0 ? String(studentCount) : null },
  ];

  const specNav = specialty ? SPECIALTY_NAV[specialty] : [];
  for (const item of specNav) {
    navItems.push({ ...item, badge: null });
  }

  const extraNav = specialty ? SPECIALTY_EXTRA_NAV[specialty] : [];
  for (const item of extraNav) {
    navItems.push({ ...item, badge: null });
  }
  navItems.push({ title: "Treinar a IA", path: "/especialista/ia", icon: Brain, badge: null });
  navItems.push({ title: "Chat", path: "/especialista/chat", icon: MessageSquare, badge: null });
  navItems.push({ title: "Meu Perfil", path: "/especialista/perfil", icon: UserCog, badge: null });

  const isActive = (path: string) => {
    if (path === "/especialista") return location.pathname === "/especialista";
    return location.pathname.startsWith(path);
  };

  const currentPage = navItems.find((item) => isActive(item.path));

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <InsanoLogo size={28} />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
          </div>
          <div className="flex flex-col">
            <span className="font-cinzel text-sm font-bold tracking-wider gold-text-gradient">FORJA</span>
            <span className="text-[9px] text-muted-foreground tracking-widest uppercase">
              {rawSpecialty || "Especialista"}
            </span>
          </div>
        </div>
        {/* Desktop: collapse button | Mobile: close button */}
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => {
              // On mobile close the drawer, on desktop toggle collapse
              if (window.innerWidth < 768) {
                setMobileOpen(false);
              } else {
                setCollapsed(!collapsed);
              }
            }}
            className="p-1.5 rounded-md hover:bg-[hsl(var(--glass-highlight))] text-muted-foreground transition-colors"
          >
            {window.innerWidth < 768 ? <X size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                active
                  ? "bg-[hsl(var(--glass-highlight))] text-foreground font-medium"
                  : "text-muted-foreground hover:bg-[hsl(var(--glass-bg))] hover:text-foreground"
              )}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
              )}
              <item.icon
                size={18}
                className={cn("shrink-0 transition-colors", active ? "text-accent" : "group-hover:text-foreground")}
              />
              <span className="flex-1">{item.title}</span>
              {item.badge && (
                <span
                  className={cn(
                    "min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-[hsl(var(--glass-highlight))] text-muted-foreground"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/50 text-center">
        <span className="text-[10px] text-muted-foreground/50">Forja</span>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border/50 transition-all duration-300 flex-col hidden md:flex",
          "bg-[hsl(0_0%_5%/0.95)] backdrop-blur-xl",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Collapsed desktop sidebar */}
        {collapsed ? (
          <>
            <div className="flex items-center justify-center p-4 border-b border-border/50">
              <button
                onClick={() => setCollapsed(false)}
                className="p-1.5 rounded-md hover:bg-[hsl(var(--glass-highlight))] text-muted-foreground transition-colors"
              >
                <Menu size={18} />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "group relative flex items-center justify-center p-2.5 rounded-lg transition-all duration-200",
                      active
                        ? "bg-[hsl(var(--glass-highlight))] text-foreground"
                        : "text-muted-foreground hover:bg-[hsl(var(--glass-bg))] hover:text-foreground"
                    )}
                    title={item.title}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent" />
                    )}
                    <item.icon size={18} className={cn("shrink-0", active ? "text-accent" : "")} />
                  </Link>
                );
              })}
            </nav>
          </>
        ) : (
          sidebarContent
        )}
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-screen w-72 flex flex-col md:hidden bg-[hsl(0_0%_5%/0.98)] backdrop-blur-xl border-r border-border/50"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-30 md:hidden bg-[hsl(0_0%_5%/0.95)] backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-md hover:bg-[hsl(var(--glass-highlight))] text-muted-foreground transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <InsanoLogo size={22} />
              <span className="font-cinzel text-sm font-bold gold-text-gradient">
                {currentPage?.title ?? "FORJA"}
              </span>
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300 overflow-x-hidden",
          collapsed ? "md:ml-16" : "md:ml-60",
          "mt-14 md:mt-0"
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default EspecialistaLayout;
