import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMySpecialty } from "@/hooks/useSpecialistStudents";

type Specialty = "personal" | "nutricionista";

const ALLOWED_ROUTES: Record<Specialty, string[]> = {
  personal: ["/especialista/treinos", "/especialista/exercicios"],
  nutricionista: ["/especialista/dietas", "/especialista/alimentos"],
};

function normalizeSpecialty(raw: string | null): Specialty | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("preparador") || lower.includes("fisico") || lower.includes("personal")) return "personal";
  if (lower.includes("nutricionista")) return "nutricionista";
  return null;
}

/** Returns which specialty-specific routes this specialist can access */
export function useAllowedRoutes() {
  const { data: mySpecialty, isLoading } = useMySpecialty();
  const normalized = normalizeSpecialty(mySpecialty);
  const allowed = normalized ? ALLOWED_ROUTES[normalized] : [];
  return { allowed, specialty: normalized, rawSpecialty: mySpecialty, isLoading };
}

/** Redirects to /especialista if the current route is not allowed for this specialist */
export function useSpecialtyGuard(currentPath: string) {
  const navigate = useNavigate();
  const { allowed, specialty, isLoading } = useAllowedRoutes();

  useEffect(() => {
    if (isLoading || !specialty) return;

    const protectedRoutes = ["/especialista/treinos", "/especialista/exercicios", "/especialista/dietas", "/especialista/alimentos"];
    const isProtected = protectedRoutes.some((r) => currentPath.startsWith(r));

    if (isProtected && !allowed.some((r) => currentPath.startsWith(r))) {
      navigate("/especialista", { replace: true });
    }
  }, [currentPath, allowed, specialty, isLoading, navigate]);
}
