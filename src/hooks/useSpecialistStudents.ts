import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StudentWithDetails {
  id: string;
  name: string;
  email: string;
  status: "ativo" | "alerta" | "inativo";
  specialty: string;
  telefone: string | null;
  nascimento: string | null;
  sexo: string | null;
  peso: string | null;
  altura: string | null;
  avatar_url: string | null;
  created_at: string;
}

export const useSpecialistStudents = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["specialist-students", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data: links, error: linksError } = await supabase
        .from("student_specialists")
        .select("student_id, specialty")
        .eq("specialist_id", user.id);

      if (linksError) throw linksError;
      if (!links || links.length === 0) return [];

      const studentIds = links.map((l) => l.student_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome, email, telefone, nascimento, sexo, peso, altura, avatar_url, status, created_at")
        .in("id", studentIds);

      if (profilesError) throw profilesError;

      const specMap = new Map(links.map((l) => [l.student_id, l.specialty]));

      return (profilesData ?? []).map((p): StudentWithDetails => {
        // Derive status from profile status
        let status: "ativo" | "alerta" | "inativo" = "ativo";
        if (p.status === "inativo" || p.status === "cancelado") status = "inativo";
        else if (p.status === "pendente" || p.status === "pendente_onboarding") status = "alerta";

        return {
          id: p.id,
          name: p.nome ?? p.email ?? "Sem nome",
          email: p.email ?? "",
          status,
          specialty: specMap.get(p.id) ?? "",
          telefone: p.telefone,
          nascimento: p.nascimento,
          sexo: p.sexo,
          peso: p.peso,
          altura: p.altura,
          avatar_url: p.avatar_url ?? null,
          created_at: p.created_at,
        };
      });
    },
    enabled: !!user,
  });
};

/** Returns the specialty of the currently logged-in specialist */
export const useMySpecialty = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-specialty", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      // Try student_specialists first
      const { data, error } = await supabase
        .from("student_specialists")
        .select("specialty")
        .eq("specialist_id", user.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data?.specialty) return data.specialty;

      // Fallback: check user_roles for nutricionista/personal
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["nutricionista", "personal"]);
      if (rolesErr) throw rolesErr;
      if (roles && roles.length > 0) return roles[0].role;

      return null;
    },
    enabled: !!user,
  });
};

/** Fetches the latest anamnese for a given student */
export const useStudentAnamnese = (studentId: string | null) => {
  return useQuery({
    queryKey: ["student-anamnese", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data, error } = await supabase
        .from("anamnese")
        .select("*")
        .eq("user_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });
};
