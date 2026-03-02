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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 transition-all duration-200 ${
                isActive
                  ? "text-accent scale-110"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <item.icon size={22} strokeWidth={2} />
            <span className="text-[10px] font-cinzel font-semibold tracking-wider uppercase">
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
