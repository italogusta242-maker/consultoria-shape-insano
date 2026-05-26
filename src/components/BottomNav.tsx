import { NavLink } from "react-router-dom";
import { Home, Dumbbell, UtensilsCrossed, MessageCircle, User } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/treinos", icon: Dumbbell, label: "Treinos" },
  { to: "/dieta", icon: UtensilsCrossed, label: "Dieta" },
  { to: "/chat", icon: MessageCircle, label: "Chat" },
  { to: "/perfil", icon: User, label: "Perfil" },
];

const BottomNav = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 supports-[backdrop-filter]:bg-background/70 bg-background/95 backdrop-blur-xl backdrop-saturate-150 border-t border-border/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className={isActive ? "drop-shadow-[0_0_8px_hsl(var(--primary)/0.45)]" : ""}
                />
                <span
                  className={`text-[10px] tracking-tight ${
                    isActive ? "font-semibold" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
