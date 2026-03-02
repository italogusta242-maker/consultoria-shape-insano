import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useNavigate, useLocation } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [postLoginLoading, setPostLoginLoading] = useState(false);
  const [minLoadingDone, setMinLoadingDone] = useState(false);
  const didRedirectRef = useRef(false);
  const minLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check role and redirect specialists/admins after login
  const checkRoleAndRedirect = async (userId: string) => {
    if (didRedirectRef.current) return;
    const path = window.location.pathname;
    if (path.startsWith("/especialista") || path.startsWith("/admin") || path.startsWith("/closer") || path.startsWith("/cs") || path.startsWith("/convite")) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!roles || roles.length === 0) return;

    const roleSet = new Set(roles.map((r) => r.role));
    didRedirectRef.current = true;
    if (roleSet.has("admin")) {
      navigate("/admin", { replace: true });
    } else if (roleSet.has("especialista") || roleSet.has("nutricionista") || roleSet.has("personal")) {
      navigate("/especialista", { replace: true });
    } else if (roleSet.has("cs")) {
      navigate("/cs", { replace: true });
    } else if (roleSet.has("closer")) {
      navigate("/closer", { replace: true });
    }
  };

  // Fetch onboarded status from profiles
  const fetchOnboarded = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", userId)
      .maybeSingle();
    setOnboarded(data?.onboarded ?? false);
  };

  useEffect(() => {
    didRedirectRef.current = false;
    let cancelled = false;
    let hasSession = false;

    // Minimum loading time to prevent flash of unloaded content
    const minLoadingTimer = setTimeout(() => {
      setMinLoadingDone(true);
    }, 1800);

    // Safety timeout — only fires if no session was found (no user)
    const timeout = setTimeout(() => {
      if (!cancelled && !hasSession) setLoading(false);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          hasSession = true;
          // For ANY event with a valid session, fetch onboarded before ending loading
          setTimeout(async () => {
            await fetchOnboarded(newSession.user.id);
            // Redirect on login AND on initial session (page refresh)
            if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
              await checkRoleAndRedirect(newSession.user.id);
            }
            if (!cancelled) {
              setLoading(false);
              clearTimeout(timeout);
            }
          }, 0);
        } else {
          setOnboarded(false);
          if (!cancelled) {
            setLoading(false);
            clearTimeout(timeout);
          }
        }
      }
    );

    // getSession as fallback — onAuthStateChange above handles setting loading=false
    supabase.auth.getSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timeout);
      clearTimeout(minLoadingTimer);
    };
  }, []);

  // Only stop loading when both auth is resolved AND minimum time has passed
  const isLoading = loading || !minLoadingDone || postLoginLoading;

  const signUp = async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome: name },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    // Show loading splash immediately on login attempt
    setPostLoginLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setPostLoginLoading(false);
      return { error: error.message };
    }
    // Keep splash for 2s after successful login to let queries hydrate
    setTimeout(() => {
      setPostLoginLoading(false);
    }, 2000);
    return { error: null };
  };

  const signOut = async () => {
    try {
      didRedirectRef.current = false;
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    } finally {
      setUser(null);
      setSession(null);
      setOnboarded(false);
      navigate("/", { replace: true });
      window.location.href = "/"; // Force page reload to clear memory caches if needed
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading: isLoading,
      onboarded,
      setOnboarded,
      signUp,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
