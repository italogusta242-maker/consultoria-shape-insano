import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  // Tracks whether we've finished checking the profiles.onboarded flag for the
  // current user. Starts as `true` when there's no user (nothing to resolve);
  // flips to `false` the moment a session lands and back to `true` only after
  // fetchOnboarded completes. Prevents the "Onboarding flashes for a few ms
  // before the real page loads" race.
  const [onboardedResolved, setOnboardedResolved] = useState(true);
  const [postLoginLoading, setPostLoginLoading] = useState(false);
  const [minLoadingDone, setMinLoadingDone] = useState(false);
  const didRedirectRef = useRef(false);

  // Check role and redirect specialists/admins after login — fail-safe
  const checkRoleAndRedirect = async (userId: string) => {
    try {
      if (didRedirectRef.current) return;
      const path = window.location.pathname;
      if (
        path.startsWith("/especialista") ||
        path.startsWith("/admin") ||
        path.startsWith("/closer") ||
        path.startsWith("/cs") ||
        path.startsWith("/convite") ||
        path === "/destravar" ||
        path === "/instalar"
      ) {
        return;
      }

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.warn("[Auth] role lookup failed, continuing without redirect", error);
        return;
      }
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
    } catch (e) {
      console.warn("[Auth] checkRoleAndRedirect crashed, continuing", e);
    }
  };

  // Fetch onboarded status from profiles — fail-safe.
  // Always flips `onboardedResolved` to true at the end so the UI never gets
  // stuck on the splash if the query fails.
  const fetchOnboarded = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.warn("[Auth] fetchOnboarded failed, defaulting to false", error);
        setOnboarded(false);
        return;
      }
      setOnboarded(data?.onboarded ?? false);
    } catch (e) {
      console.warn("[Auth] fetchOnboarded crashed, defaulting to false", e);
      setOnboarded(false);
    } finally {
      setOnboardedResolved(true);
    }
  };

  useEffect(() => {
    didRedirectRef.current = false;
    let cancelled = false;

    // Minimum loading time to prevent flash of unloaded content
    const minLoadingTimer = setTimeout(() => {
      if (!cancelled) setMinLoadingDone(true);
    }, 1200);

    // Hard safety timeout — ALWAYS releases the splash, even if a session exists
    // and background queries hang. This prevents permanent "Carregando..." lock.
    const hardTimeout = setTimeout(() => {
      if (!cancelled) {
        console.warn("[Auth] hard timeout reached, releasing loading state");
        setLoading(false);
      }
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Synchronous state updates only inside the callback
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // CRITICAL: release the app immediately on session resolution.
          // Enrichment (profile/roles) happens in the background.
          if (!cancelled) setLoading(false);

          // Defer all Supabase calls to avoid deadlocks inside the callback
          setTimeout(() => {
            if (cancelled) return;
            // Fire and forget — these are fail-safe internally
            void fetchOnboarded(newSession.user.id);
            if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
              void checkRoleAndRedirect(newSession.user.id);
            }
          }, 0);
        } else {
          setOnboarded(false);
          if (!cancelled) setLoading(false);
        }
      }
    );

    // Trigger initial session resolution
    supabase.auth.getSession().catch((e) => {
      console.warn("[Auth] getSession failed", e);
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(hardTimeout);
      clearTimeout(minLoadingTimer);
    };
  }, []);

  // Only stop loading when both auth is resolved AND minimum time has passed
  const isLoading = (loading || !minLoadingDone || postLoginLoading);

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
    setPostLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setPostLoginLoading(false);
        return { error: error.message };
      }
      // Brief splash to let initial queries hydrate, but not blocking
      setTimeout(() => setPostLoginLoading(false), 1200);
      return { error: null };
    } catch (e: any) {
      setPostLoginLoading(false);
      return { error: e?.message ?? "Erro inesperado ao entrar" };
    }
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
