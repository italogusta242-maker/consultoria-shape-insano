import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserCheck, Users, Loader2, ShieldAlert, Dumbbell, Apple, XCircle, Eye, ArrowLeft } from "lucide-react";

interface PendingStudent {
  id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
  status: string;
}

interface Specialist {
  user_id: string;
  role: string;
  nome: string | null;
  email: string | null;
  specialty_hint: string | null;
}

// --- Hooks ---

const usePendingStudents = () => {
  return useQuery({
    queryKey: ["pending-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, created_at, status")
        .eq("status", "anamnese_concluida")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingStudent[];
    },
  });
};

const useSpecialists = () => {
  return useQuery({
    queryKey: ["all-specialists"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["personal", "nutricionista"]);
      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) return [];

      const ids = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles, error: profError } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", ids);
      if (profError) throw profError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return roles.map((r): Specialist => {
        const prof = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          role: r.role,
          nome: prof?.nome ?? null,
          email: prof?.email ?? null,
          specialty_hint: r.role,
        };
      });
    },
  });
};

// --- Student Profile Viewer ---

function StudentProfileViewer({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const { data: profile, isLoading: profLoading } = useQuery({
    queryKey: ["student-full-profile", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", studentId)
        .maybeSingle();
      return data;
    },
  });

  const { data: anamnese, isLoading: anaLoading } = useQuery({
    queryKey: ["student-anamnese", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("anamnese")
        .select("*")
        .eq("user_id", studentId)
        .maybeSingle();
      return data;
    },
  });

  if (profLoading || anaLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fields = [
    { label: "Nome", value: profile?.nome },
    { label: "Email", value: profile?.email },
    { label: "Telefone", value: profile?.telefone },
    { label: "CPF", value: profile?.cpf },
    { label: "Nascimento", value: profile?.nascimento },
    { label: "Sexo", value: profile?.sexo },
    { label: "Cidade/Estado", value: profile?.cidade_estado },
    { label: "Peso", value: profile?.peso },
    { label: "Altura", value: profile?.altura },
    { label: "Meta Peso", value: profile?.meta_peso },
    { label: "Faixa Etária", value: (() => {
      if (!profile?.nascimento) return profile?.faixa_etaria || null;
      const birth = new Date(profile.nascimento);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) return `${age} anos (Menor de 18)`;
      if (age <= 25) return `${age} anos (18-25)`;
      if (age <= 35) return `${age} anos (26-35)`;
      if (age <= 45) return `${age} anos (36-45)`;
      if (age <= 55) return `${age} anos (46-55)`;
      return `${age} anos (56+)`;
    })() },
    { label: "Como Chegou", value: profile?.como_chegou },
    { label: "Indicação", value: profile?.indicacao },
  ];

  const anaFields = anamnese
    ? [
        { label: "Objetivo", value: anamnese.objetivo },
        { label: "Motivação", value: anamnese.motivacao },
        { label: "Experiência Treino", value: anamnese.experiencia_treino },
        { label: "Frequência Treino", value: anamnese.frequencia_treino },
        { label: "Local Treino", value: anamnese.local_treino },
        { label: "Equipamentos", value: anamnese.equipamentos },
        { label: "Dieta Atual", value: anamnese.dieta_atual },
        { label: "Restrições Alimentares", value: anamnese.restricoes_alimentares },
        { label: "Suplementos", value: anamnese.suplementos },
        { label: "Água Diária", value: anamnese.agua_diaria },
        { label: "Horas de Sono", value: anamnese.sono_horas },
        { label: "Nível de Estresse", value: anamnese.nivel_estresse },
        { label: "Condições Saúde", value: anamnese.condicoes_saude },
        { label: "Lesões", value: anamnese.lesoes },
        { label: "Medicamentos", value: anamnese.medicamentos },
        { label: "Ocupação", value: anamnese.ocupacao },
        { label: "Disponibilidade Treino", value: anamnese.disponibilidade_treino },
      ]
    : [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
        <ArrowLeft size={14} /> Voltar
      </Button>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Dados Pessoais</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</p>
              <p className="text-sm text-foreground">{f.value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {anaFields.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Anamnese</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {anaFields.map((f) => (
              <div key={f.label}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</p>
                <p className="text-sm text-foreground">{f.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Panel ---

const PendingStudentsPanel = () => {
  const queryClient = useQueryClient();
  const { data: students, isLoading } = usePendingStudents();
  const { data: specialists } = useSpecialists();
  const [selectedStudent, setSelectedStudent] = useState<PendingStudent | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [preparadorId, setPreparadorId] = useState("");
  const [nutricionistaId, setNutricionistaId] = useState("");
  const [dialogMode, setDialogMode] = useState<"authorize" | "reject" | "view">("view");

  const [planLimitation, setPlanLimitation] = useState<string>("nenhum");

  const authorizeMutation = useMutation({
    mutationFn: async ({ studentId, prepId, nutId, limitation }: { studentId: string; prepId: string; nutId: string; limitation: string }) => {
      // Remove any existing specialist links to avoid duplicate key errors
      await supabase.from("student_specialists").delete().eq("student_id", studentId);

      const links: { student_id: string; specialist_id: string; specialty: string }[] = [];
      if (limitation !== "apenas_nutricionista" && prepId) {
        links.push({ student_id: studentId, specialist_id: prepId, specialty: "preparador" });
      }
      if (limitation !== "apenas_preparador" && nutId) {
        links.push({ student_id: studentId, specialist_id: nutId, specialty: "nutricionista" });
      }

      if (links.length > 0) {
        const { error: linkError } = await supabase.from("student_specialists").insert(links);
        if (linkError) throw linkError;
      }

      const { error: statusError } = await supabase
        .from("profiles")
        .update({ status: "ativo", onboarded: true })
        .eq("id", studentId);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      toast.success("Aluno autorizado e especialistas atribuídos!");
      queryClient.invalidateQueries({ queryKey: ["pending-students"] });
      closeDialog();
    },
    onError: (err: Error) => toast.error("Erro ao autorizar: " + err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: studentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Aluno recusado e conta removida.");
      queryClient.invalidateQueries({ queryKey: ["pending-students"] });
      closeDialog();
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const closeDialog = () => {
    setSelectedStudent(null);
    setViewingStudentId(null);
    setPreparadorId("");
    setNutricionistaId("");
    setPlanLimitation("nenhum");
    setDialogMode("view");
  };

  const openStudent = (student: PendingStudent) => {
    setSelectedStudent(student);
    setViewingStudentId(null);
    setDialogMode("view");
  };

  const prepList = (specialists ?? []).filter(s => s.role === "personal");
  const nutList = (specialists ?? []).filter(s => s.role === "nutricionista");

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!students || students.length === 0) return null;

  return (
    <>
      <Card className="bg-card border-border border-l-4 border-l-gold">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <ShieldAlert size={16} className="text-gold" />
            Novos Alunos Aguardando Autorização
            <Badge variant="secondary" className="ml-auto bg-gold/20 text-gold">
              {students.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => openStudent(student)}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 w-full text-left hover:bg-secondary/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center">
                    <Users size={16} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {student.nome ?? "Sem nome"}
                    </p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-gold/30 text-gold">
                    Anamnese concluída
                  </Badge>
                  <Eye size={16} className="text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Student Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cinzel">
              {dialogMode === "view" && (selectedStudent?.nome ?? "Aluno")}
              {dialogMode === "authorize" && "Autorizar Aluno"}
              {dialogMode === "reject" && "Recusar Aluno"}
            </DialogTitle>
          </DialogHeader>

          {/* VIEW MODE */}
          {dialogMode === "view" && selectedStudent && (
            <div className="space-y-4 mt-2">
              <StudentProfileViewer
                studentId={selectedStudent.id}
                onBack={closeDialog}
              />
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  className="flex-1 gap-1.5"
                  onClick={async () => {
                    // Auto-detect plan limitation from invite
                    if (selectedStudent.email) {
                      const { data: invite } = await supabase
                        .from("invites")
                        .select("subscription_plan_id")
                        .eq("email", selectedStudent.email)
                        .order("created_at", { ascending: false })
                        .limit(1)
                        .maybeSingle();
                      if (invite?.subscription_plan_id) {
                        const { data: plan } = await supabase
                          .from("subscription_plans")
                          .select("specialist_limitation")
                          .eq("id", invite.subscription_plan_id)
                          .maybeSingle();
                        if (plan?.specialist_limitation) {
                          setPlanLimitation(plan.specialist_limitation as string);
                        }
                      }
                    }
                    setDialogMode("authorize");
                  }}
                >
                  <UserCheck size={16} /> Autorizar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-1.5"
                  onClick={() => setDialogMode("reject")}
                >
                  <XCircle size={16} /> Recusar
                </Button>
              </div>
            </div>
          )}

          {/* AUTHORIZE MODE */}
          {dialogMode === "authorize" && selectedStudent && (
            <div className="space-y-5 mt-2">
              <div className="p-3 rounded-lg bg-secondary/50">
                <p className="font-medium text-foreground">{selectedStudent.nome ?? "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{selectedStudent.email}</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">Limitação do Plano</Label>
                <Select value={planLimitation} onValueChange={setPlanLimitation}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhuma (ambos os especialistas)</SelectItem>
                    <SelectItem value="apenas_nutricionista">Apenas Nutricionista</SelectItem>
                    <SelectItem value="apenas_preparador">Apenas Preparador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {planLimitation !== "apenas_nutricionista" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Dumbbell size={14} className="text-primary" />
                    Preparador Físico
                  </Label>
                  <Select value={preparadorId} onValueChange={setPreparadorId}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o preparador" />
                    </SelectTrigger>
                    <SelectContent>
                      {prepList.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.nome ?? s.email ?? s.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {planLimitation !== "apenas_preparador" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Apple size={14} className="text-emerald-500" />
                    Nutricionista
                  </Label>
                  <Select value={nutricionistaId} onValueChange={setNutricionistaId}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o nutricionista" />
                    </SelectTrigger>
                    <SelectContent>
                      {nutList.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.nome ?? s.email ?? s.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogMode("view")}>
                  Voltar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={
                    (planLimitation !== "apenas_nutricionista" && !preparadorId) ||
                    (planLimitation !== "apenas_preparador" && !nutricionistaId) ||
                    authorizeMutation.isPending
                  }
                  onClick={() => {
                    authorizeMutation.mutate({
                      studentId: selectedStudent.id,
                      prepId: preparadorId,
                      nutId: nutricionistaId,
                      limitation: planLimitation,
                    });
                  }}
                >
                  {authorizeMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Autorizando...</>
                  ) : (
                    <><UserCheck size={16} /> Confirmar</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* REJECT MODE */}
          {dialogMode === "reject" && selectedStudent && (
            <div className="space-y-5 mt-2">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-foreground">
                  Tem certeza que deseja recusar <strong>{selectedStudent.nome ?? selectedStudent.email}</strong>?
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O status será alterado para "inativo" e o aluno não terá acesso à plataforma.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDialogMode("view")}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 gap-2"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(selectedStudent.id)}
                >
                  {rejectMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Recusando...</>
                  ) : (
                    <><XCircle size={16} /> Confirmar Recusa</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingStudentsPanel;
