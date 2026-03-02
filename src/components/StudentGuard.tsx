import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const StudentGuard = () => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

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
    };

    if (!loading) check();
  }, [user, loading]);

  if (loading || checking) return null;
  if (redirect) return <Navigate to={redirect} replace />;
  return <Outlet />;
};

export default StudentGuard;
