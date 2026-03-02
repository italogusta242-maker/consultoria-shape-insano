import { useEffect, useState, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AcessoNegado from "@/pages/AcessoNegado";

type AllowedRole = "admin" | "closer" | "cs" | "personal" | "nutricionista";

interface RoleGuardProps {
  allowedRoles: AllowedRole[];
}

// Cache roles per user to avoid re-fetching on every navigation
const rolesCache: { userId: string | null; roles: string[] } = { userId: null, roles: [] };

const RoleGuard = ({ allowedRoles }: RoleGuardProps) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setChecking(false);
        setHasAccess(false);
        return;
      }

      // Use cached roles if same user
      if (rolesCache.userId === user.id && rolesCache.roles.length > 0) {
        const allowed = allowedRoles.some((role) => rolesCache.roles.includes(role));
        setHasAccess(allowed);
        setChecking(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        console.error("RoleGuard: error fetching roles", error);
        setHasAccess(false);
        setChecking(false);
        return;
      }

      const userRoles = (data ?? []).map((r) => r.role);
      rolesCache.userId = user.id;
      rolesCache.roles = userRoles;

      const allowed = allowedRoles.some((role) => userRoles.includes(role));
      setHasAccess(allowed);
      setChecking(false);
    };

    if (!loading) {
      checkRole();
    }
  }, [user, loading, allowedRoles]);

  if (loading || checking) {
    return null; // Don't show orange splash on navigation, parent already handles initial loading
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!hasAccess) {
    return <AcessoNegado />;
  }

  return <Outlet />;
};

export default RoleGuard;
