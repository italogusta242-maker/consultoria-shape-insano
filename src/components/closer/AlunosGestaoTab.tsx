import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Search, Send, CheckCircle2, Loader2 } from "lucide-react";

interface StudentWithSpecialists {
  id: string;
  nome: string | null;
  email: string | null;
  status: string;
  created_at: string;
  nutricionista: string | null;
  personal: string | null;
}

const AlunosGestaoTab = () => {
  const [search, setSearch] = useState("");
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch students that came from THIS closer's invites
  const { data: students, isLoading } = useQuery({
    queryKey: ["closer-students-gestao", user?.id],
    queryFn: async () => {
      // Get invites created by this closer that were used
      const { data: usedInvites, error: invErr } = await supabase
        .from("invites")
        .select("email")
        .eq("created_by", user!.id)
        .eq("status", "used");

      if (invErr) throw invErr;
      if (!usedInvites || usedInvites.length === 0) return [];

      const emails = usedInvites.map((i) => i.email.toLowerCase());

      // Get profiles matching those emails
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, nome, email, status, created_at")
        .in("email", emails)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      // Get specialist links for these students
      const studentIds = profiles.map((p) => p.id);
      const { data: links } = await supabase
        .from("student_specialists")
        .select("student_id, specialist_id, specialty")
        .in("student_id", studentIds);

      // Get specialist names
      const specialistIds = [...new Set((links || []).map((l) => l.specialist_id))];
      let specialistNames: Record<string, string> = {};
      if (specialistIds.length > 0) {
        const { data: specProfiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", specialistIds);
        specProfiles?.forEach((sp) => {
          specialistNames[sp.id] = sp.nome || "Sem nome";
        });
      }

      return profiles.map((p): StudentWithSpecialists => {
        const studentLinks = (links || []).filter((l) => l.student_id === p.id);
        const nutriLink = studentLinks.find((l) => l.specialty === "nutricionista");
        const personalLink = studentLinks.find((l) => l.specialty === "personal");
        return {
          ...p,
          nutricionista: nutriLink ? specialistNames[nutriLink.specialist_id] || "Vinculado" : null,
          personal: personalLink ? specialistNames[personalLink.specialist_id] || "Vinculado" : null,
        };
      });
    },
    enabled: !!user,
  });

  const handleSolicitarVinculo = async (student: StudentWithSpecialists) => {
    setSendingFor(student.id);
    try {
      // Find all admin user IDs
      const { data: adminRoles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesErr) throw rolesErr;
      if (!adminRoles || adminRoles.length === 0) {
        toast.error("Nenhum administrador encontrado no sistema.");
        return;
      }

      // Create a notification for each admin
      const notifications = adminRoles.map((ar) => ({
        user_id: ar.user_id,
        title: "📋 Solicitação de Vínculo",
        body: `O aluno ${student.nome || student.email} precisa ser vinculado a um Preparador Físico e Nutricionista.`,
        type: "vinculo_request",
        metadata: {
          student_id: student.id,
          student_name: student.nome,
          student_email: student.email,
          requested_by: "closer",
        },
      }));

      const { error: notifErr } = await supabase.from("notifications").insert(notifications);
      if (notifErr) throw notifErr;

      toast.success(`Solicitação enviada ao administrador para vincular ${student.nome || student.email}!`);
    } catch (e: any) {
      console.error("Erro ao solicitar vínculo:", e);
      toast.error("Erro ao enviar solicitação: " + (e.message || ""));
    } finally {
      setSendingFor(null);
    }
  };

  const filtered = (students || []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.nome?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
  });

  const needsLink = (s: StudentWithSpecialists) => !s.nutricionista || !s.personal;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Users size={16} className="text-primary" />
            Gestão e Vínculo de Alunos
          </CardTitle>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-background border-border w-[200px]"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Nome / E-mail</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Nutricionista</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Preparador Físico</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="p-2">
                      <p className="font-medium text-foreground">{s.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </td>
                    <td className="p-2">
                      <span className={`text-xs font-semibold ${
                        s.status === "ativo" ? "text-emerald-400" :
                        s.status === "anamnese_concluida" ? "text-amber-400" :
                        "text-muted-foreground"
                      }`}>
                        {s.status === "ativo" ? "Ativo" :
                         s.status === "anamnese_concluida" ? "Aguardando Vínculo" :
                         "Pendente"}
                      </span>
                    </td>
                    <td className="p-2">
                      {s.nutricionista ? (
                        <span className="text-xs px-2 py-1 bg-secondary text-foreground rounded-full">{s.nutricionista}</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full">Sem Vínculo</span>
                      )}
                    </td>
                    <td className="p-2">
                      {s.personal ? (
                        <span className="text-xs px-2 py-1 bg-secondary text-foreground rounded-full">{s.personal}</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-destructive/10 text-destructive rounded-full">Sem Vínculo</span>
                      )}
                    </td>
                    <td className="p-2">
                      {needsLink(s) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-primary text-primary hover:bg-primary/10"
                          disabled={sendingFor === s.id}
                          onClick={() => handleSolicitarVinculo(s)}
                        >
                          {sendingFor === s.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          Solicitar Vínculo
                        </Button>
                      ) : (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Vinculado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AlunosGestaoTab;
