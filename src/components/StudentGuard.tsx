import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const StudentGuard = () => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (error) {
          console.warn("StudentGuard: role lookup failed, allowing student route", error);
          setChecking(false);
          return;
        }

        const roles = new Set((data ?? []).map((r) => r.role));

        if (roles.has("admin")) {
          setRedirect("/admin");
        } else if (roles.has("personal") || roles.has("nutricionista")) {
          setRedirect("/especialista");
        } else if (roles.has("cs")) {
          setRedirect("/cs");
        } else if (roles.has("closer")) {
          setRedirect("/closer");
        }

        setChecking(false);
      } catch (e) {
        console.warn("StudentGuard: crash, allowing student route", e);
        if (!cancelled) setChecking(false);
      }
    };

    if (!loading) {
      check();
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
  }, [user, loading]);

  if (loading || checking) return null;
  if (redirect) return <Navigate to={redirect} replace />;
  return <Outlet />;
};

export default StudentGuard;
