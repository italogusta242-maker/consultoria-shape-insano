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
    let cancelled = false;
    const checkRole = async () => {
      if (!user) {
        if (!cancelled) {
          setChecking(false);
          setHasAccess(false);
        }
        return;
      }

      // Use cached roles if same user — instant
      if (rolesCache.userId === user.id && rolesCache.roles.length > 0) {
        const allowed = allowedRoles.some((role) => rolesCache.roles.includes(role));
        if (!cancelled) {
          setHasAccess(allowed);
          setChecking(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (cancelled) return;

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
      } catch (e) {
        console.error("RoleGuard: crash fetching roles", e);
        if (!cancelled) {
          setHasAccess(false);
          setChecking(false);
        }
      }
    };

    if (!loading) {
      checkRole();
      // Safety: never stay invisible forever
      const t = setTimeout(() => {
        if (!cancelled) setChecking(false);
      }, 5000);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    return () => {
      cancelled = true;
    };
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
