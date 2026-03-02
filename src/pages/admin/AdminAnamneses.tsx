import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ClipboardList, Calendar, User, Dumbbell, Apple, Brain, Loader2, ChevronDown, ChevronUp, Send, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
  created_at: string;
  telefone?: string | null;
  cpf?: string | null;
  sexo?: string | null;
  nascimento?: string | null;
  peso?: string | null;
  altura?: string | null;
  meta_peso?: string | null;
  cidade_estado?: string | null;
  bairro?: string | null;
  logradouro?: string | null;
  cep?: string | null;
  faixa_etaria?: string | null;
  como_chegou?: string | null;
  indicacao?: string | null;
  indicacao_nome?: string | null;
  indicacao_telefone?: string | null;
  tempo_acompanha?: string | null;
  fatores_escolha?: string | null;
  body_fat?: number | null;
}

interface AnamneseRow {
  id: string;
  user_id: string;
  created_at: string;
  objetivo: string | null;
  experiencia_treino: string | null;
  frequencia_treino: string | null;
  local_treino: string | null;
  lesoes: string | null;
  restricoes_alimentares: string | null;
  dieta_atual: string | null;
  suplementos: string | null;
  agua_diaria: string | null;
  sono_horas: string | null;
  condicoes_saude: string | null;
  medicamentos: string | null;
  nivel_estresse: string | null;
  motivacao: string | null;
  equipamentos: string | null;
  disponibilidade_treino: string | null;
  ocupacao: string | null;
  dados_extras: Record<string, any> | null;
}

interface AssessmentRow {
  id: string;
  user_id: string;
  created_at: string;
  peso: string | null;
  altura: string | null;
  objetivo_atual: string | null;
  adesao_treinos: number | null;
  adesao_dieta: string | null;
  adesao_cardios: number | null;
  nivel_fadiga: number | null;
  prioridades_fisicas: string | null;
  sugestao_melhoria: string | null;
  sugestao_dieta: string | null;
  modalidade: string | null;
  frequencia_compromisso: string | null;
  notas_progressao: string | null;
}

type TimelineEntry = {
  type: "anamnese" | "assessment";
  date: string;
  month: string;
  data: AnamneseRow | AssessmentRow;
};

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm text-foreground font-medium">{value || "—"}</p>
  </div>
);

const AdminAnamneses = () => {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [filterReassessment, setFilterReassessment] = useState<string>("all");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [anamneses, setAnamneses] = useState<AnamneseRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [isSendingAnamnese, setIsSendingAnamnese] = useState(false);
  const [isSendingAssessment, setIsSendingAssessment] = useState(false);

  const handleResendAnamneses = async () => {
    setIsSendingAnamnese(true);
    try {
      const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxy2VcEx_Yntb9y7kQKR_CYuLpDLOuDPqsGZEbdK7mnGPsjdTv3NgFY7chAq2G7rs7ifw/exec";
      const { data: allAnamneses, error: anamError } = await supabase.from("anamnese").select("*");
      if (anamError) throw anamError;
      if (!allAnamneses || allAnamneses.length === 0) {
        toast.info("Nenhuma anamnese encontrada no banco.");
        setIsSendingAnamnese(false);
        return;
      }
      const userIds = [...new Set(allAnamneses.map((a) => a.user_id))];
      const { data: profs } = await supabase.from("profiles").select("*").in("id", userIds);
      const profileMap = new Map(profs?.map((p) => [p.id, p]) || []);
      let sent = 0;
      for (const anamnese of allAnamneses) {
        const profile = profileMap.get(anamnese.user_id);
        const sheetData: Record<string, any> = {};
        // Unique identifier for upsert (avoid duplicates)
        sheetData["anamnese_id"] = anamnese.id;
        sheetData["user_id"] = anamnese.user_id;
        sheetData["action"] = "upsert";
        // Month reference for sheet organization
        sheetData["mes_referencia"] = format(parseISO(anamnese.created_at), "yyyy-MM");
        if (profile) {
          for (const [key, value] of Object.entries(profile)) {
            if (value === null || value === undefined) continue;
            if (Array.isArray(value)) sheetData[key] = value.join(", ");
            else sheetData[key] = value;
          }
        }
        for (const [key, value] of Object.entries(anamnese)) {
          if (key === "dados_extras" || key === "id" || key === "user_id") continue;
          if (value === null || value === undefined) continue;
          sheetData[`anamnese_${key}`] = value;
        }
        if (anamnese.dados_extras && typeof anamnese.dados_extras === "object") {
          for (const [key, value] of Object.entries(anamnese.dados_extras as Record<string, any>)) {
            if (value === null || value === undefined) continue;
            if (Array.isArray(value)) sheetData[key] = value.join(", ");
            else sheetData[key] = value;
          }
        }
        sheetData["data_envio"] = anamnese.created_at;
        try {
          await fetch(WEBHOOK_URL, { method: "POST", body: JSON.stringify(sheetData) });
          sent++;
        } catch (err) {
          console.error(`Erro ao enviar anamnese ${anamnese.id}:`, err);
        }
      }
      toast.success(`${sent} de ${allAnamneses.length} anamneses sincronizadas!`);
    } catch (error: any) {
      console.error("Erro ao reenviar anamneses:", error);
      toast.error("Erro ao reenviar: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsSendingAnamnese(false);
    }
  };

  const handleResendAssessments = async () => {
    setIsSendingAssessment(true);
    try {
      const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzFzk3QLHv8oxt-1xLKxILb0pmirT24Y4OxhLw3uKm1o-GR5q38sLxZVbco9raf_vmx/exec";
      const { data: allAssessments, error: assessError } = await supabase.from("monthly_assessments").select("*");
      if (assessError) throw assessError;
      if (!allAssessments || allAssessments.length === 0) {
        toast.info("Nenhuma reavaliação mensal encontrada.");
        setIsSendingAssessment(false);
        return;
      }
      const userIds = [...new Set(allAssessments.map((a: any) => a.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, nome, email, telefone, cpf").in("id", userIds);
      const profileMap = new Map(profs?.map((p) => [p.id, p]) || []);
      let sent = 0;
      for (const assessment of allAssessments) {
        const a = assessment as any;
        const profile = profileMap.get(a.user_id);
        const sheetData: Record<string, any> = {};
        // Unique identifier for upsert
        sheetData["assessment_id"] = a.id;
        sheetData["user_id"] = a.user_id;
        sheetData["action"] = "upsert";
        // Month reference
        sheetData["mes_referencia"] = format(parseISO(a.created_at), "yyyy-MM");
        // Profile info
        if (profile) {
          sheetData["nome"] = profile.nome || "";
          sheetData["email"] = profile.email || "";
          sheetData["telefone"] = profile.telefone || "";
          sheetData["cpf"] = profile.cpf || "";
        }
        // Assessment data
        for (const [key, value] of Object.entries(a)) {
          if (key === "id" || key === "user_id") continue;
          if (value === null || value === undefined) continue;
          if (Array.isArray(value)) sheetData[key] = value.join(", ");
          else sheetData[key] = value;
        }
        sheetData["data_envio"] = a.created_at;
        try {
          await fetch(WEBHOOK_URL, { method: "POST", body: JSON.stringify(sheetData) });
          sent++;
        } catch (err) {
          console.error(`Erro ao enviar reavaliação ${a.id}:`, err);
        }
      }
      toast.success(`${sent} de ${allAssessments.length} reavaliações sincronizadas!`);
    } catch (error: any) {
      console.error("Erro ao reenviar reavaliações:", error);
      toast.error("Erro ao reenviar: " + (error.message || "Erro desconhecido"));
    } finally {
      setIsSendingAssessment(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch only student profiles (exclude staff)
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").neq("role", "user");
      const staffIds = rolesData?.map(r => r.user_id) || [];

      const [profilesRes, anamneseRes, assessmentsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("anamnese").select("*"),
        supabase.from("monthly_assessments").select("*"),
      ]);

      const allProfiles = (profilesRes.data || []).filter(p => !staffIds.includes(p.id));
      setProfiles(allProfiles);
      setAnamneses((anamneseRes.data || []) as AnamneseRow[]);
      setAssessments((assessmentsRes.data || []) as AssessmentRow[]);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    if (!search) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(p =>
      (p.nome || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const studentsWithData = useMemo(() => {
    const studentIds = new Set([
      ...anamneses.map(a => a.user_id),
      ...assessments.map(a => a.user_id),
    ]);
    return filteredProfiles.filter(p => studentIds.has(p.id));
  }, [filteredProfiles, anamneses, assessments]);

  // Reassessment map: studentId → { lastDate, nextDate, daysLeft, status }
  const reassessmentMap = useMemo(() => {
    const map = new Map<string, { lastDate: Date; nextDate: Date; daysLeft: number; status: "ok" | "soon" | "overdue" }>();
    const now = new Date();

    studentsWithData.forEach(student => {
      const studentAnamneses = anamneses.filter(a => a.user_id === student.id);
      const studentAssessments = assessments.filter(a => a.user_id === student.id);

      // Find the most recent date from both anamneses and assessments
      const allDates = [
        ...studentAnamneses.map(a => new Date(a.created_at)),
        ...studentAssessments.map(a => new Date(a.created_at)),
      ];

      if (allDates.length === 0) return;

      const lastDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      const nextDate = addDays(lastDate, 30);
      const daysLeft = differenceInDays(nextDate, now);

      let status: "ok" | "soon" | "overdue" = "ok";
      if (daysLeft <= 0) status = "overdue";
      else if (daysLeft <= 7) status = "soon";

      map.set(student.id, { lastDate, nextDate, daysLeft, status });
    });

    return map;
  }, [studentsWithData, anamneses, assessments]);

  const reassessmentStats = useMemo(() => {
    let overdue = 0, soon = 0, ok = 0;
    reassessmentMap.forEach(v => {
      if (v.status === "overdue") overdue++;
      else if (v.status === "soon") soon++;
      else ok++;
    });
    return { overdue, soon, ok };
  }, [reassessmentMap]);

  // Filter students by reassessment status
  const filteredStudentsWithData = useMemo(() => {
    if (filterReassessment === "all") return studentsWithData;
    return studentsWithData.filter(s => {
      const info = reassessmentMap.get(s.id);
      if (!info) return false;
      return info.status === filterReassessment;
    });
  }, [studentsWithData, filterReassessment, reassessmentMap]);

  const timeline = useMemo(() => {
    const targetStudents = selectedStudent === "all"
      ? filteredStudentsWithData.map(s => s.id)
      : [selectedStudent];

    const entries: (TimelineEntry & { studentName: string; studentId: string })[] = [];

    targetStudents.forEach(sid => {
      const profile = profiles.find(p => p.id === sid);
      const name = profile?.nome || profile?.email || "Sem nome";

      anamneses.filter(a => a.user_id === sid).forEach(a => {
        entries.push({
          type: "anamnese",
          date: a.created_at,
          month: format(parseISO(a.created_at), "yyyy-MM"),
          data: a,
          studentName: name,
          studentId: sid,
        });
      });

      assessments.filter(a => a.user_id === sid).forEach(a => {
        entries.push({
          type: "assessment",
          date: a.created_at,
          month: format(parseISO(a.created_at), "yyyy-MM"),
          data: a,
          studentName: name,
          studentId: sid,
        });
      });
    });

    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return entries;
  }, [selectedStudent, filteredStudentsWithData, anamneses, assessments, profiles]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, typeof timeline> = {};
    timeline.forEach(entry => {
      if (!groups[entry.month]) groups[entry.month] = [];
      groups[entry.month].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [timeline]);

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Anamneses & Avaliações</h1>
        <p className="text-sm text-muted-foreground">Timeline completa desde o primeiro acesso de cada aluno</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select value={selectedStudent} onValueChange={setSelectedStudent}>
          <SelectTrigger className="w-full sm:w-[280px] bg-card border-border">
            <SelectValue placeholder="Filtrar por aluno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os alunos</SelectItem>
            {studentsWithData.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.nome || s.email || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterReassessment} onValueChange={setFilterReassessment}>
          <SelectTrigger className="w-full sm:w-[220px] bg-card border-border">
            <SelectValue placeholder="Reavaliação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            <SelectItem value="overdue">⚠️ Atrasadas</SelectItem>
            <SelectItem value="soon">⏰ Próximas (≤7 dias)</SelectItem>
            <SelectItem value="ok">✅ Em dia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Google Sheets Sync Buttons */}
      <div className="flex flex-wrap gap-3 justify-end">
        <Button
          onClick={handleResendAnamneses}
          disabled={isSendingAnamnese}
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          {isSendingAnamnese ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Send size={16} className="mr-2" />
              Sincronizar Anamneses
            </>
          )}
        </Button>
        <Button
          onClick={handleResendAssessments}
          disabled={isSendingAssessment}
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          {isSendingAssessment ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <Send size={16} className="mr-2" />
              Sincronizar Reavaliações Mensais
            </>
          )}
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Alunos com dados", value: studentsWithData.length, color: "" },
          { label: "Anamneses iniciais", value: anamneses.length, color: "" },
          { label: "Avaliações mensais", value: assessments.length, color: "" },
          { label: "Reavaliações atrasadas", value: reassessmentStats.overdue, color: reassessmentStats.overdue > 0 ? "text-destructive" : "" },
          { label: "Próximas (≤7 dias)", value: reassessmentStats.soon, color: reassessmentStats.soon > 0 ? "text-yellow-500" : "" },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className={cn("text-2xl font-bold", s.color || "text-foreground")}>{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : groupedByMonth.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma anamnese ou avaliação encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groupedByMonth.map(([monthKey, entries]) => (
            <div key={monthKey}>
              {/* Month header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 text-primary">
                  <Calendar size={14} />
                  <span className="text-sm font-cinzel font-bold">
                    {format(parseISO(`${monthKey}-01`), "MMMM yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">{entries.length} registro(s)</Badge>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Timeline entries */}
              <div className="relative ml-4 border-l-2 border-border space-y-4 pl-6">
                {entries.map((entry) => {
                  const isExpanded = expandedEntries.has(entry.data.id);
                  const isAnamnese = entry.type === "anamnese";
                  const anam = entry.data as AnamneseRow;
                  const assess = entry.data as AssessmentRow;

                  return (
                    <div key={entry.data.id} className="relative">
                      {/* Timeline dot */}
                      <div className={cn(
                        "absolute -left-[31px] top-3 w-4 h-4 rounded-full border-2 border-background",
                        isAnamnese ? "bg-primary" : "bg-accent-foreground"
                      )} />

                      <Card className="bg-card border-border hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          {/* Header */}
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleEntry(entry.data.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-lg",
                                isAnamnese ? "bg-primary/20" : "bg-secondary"
                              )}>
                                <ClipboardList size={16} className={isAnamnese ? "text-primary" : "text-muted-foreground"} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">
                                    {isAnamnese ? "Anamnese Inicial" : "Avaliação Mensal"}
                                  </p>
                                  <Badge variant={isAnamnese ? "default" : "secondary"} className="text-[10px]">
                                    {isAnamnese ? "1º Acesso" : "Mensal"}
                                  </Badge>
                                </div>
                                {selectedStudent === "all" && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <User size={10} /> {entry.studentName}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(entry.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                  {(() => {
                                    const info = reassessmentMap.get(entry.studentId);
                                    if (!info) return null;
                                    // Only show on the most recent entry for this student
                                    const isLatestForStudent = timeline.find(e => e.studentId === entry.studentId)?.data.id === entry.data.id;
                                    if (!isLatestForStudent) return null;
                                    
                                    if (info.status === "overdue") {
                                      return (
                                        <Badge variant="destructive" className="text-[10px] gap-1">
                                          <AlertTriangle size={10} />
                                          Reavaliação atrasada ({Math.abs(info.daysLeft)}d)
                                        </Badge>
                                      );
                                    }
                                    if (info.status === "soon") {
                                      return (
                                        <Badge className="text-[10px] gap-1 bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                                          <Clock size={10} />
                                          Reavaliação em {info.daysLeft}d
                                        </Badge>
                                      );
                                    }
                                    return (
                                      <Badge variant="secondary" className="text-[10px] gap-1">
                                        <CheckCircle size={10} />
                                        Próx. reav. {format(info.nextDate, "dd/MM")}
                                      </Badge>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </Button>
                          </div>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-border space-y-4">
                              {isAnamnese ? (
                                <>
                                {(() => {
                                  const prof = profiles.find(p => p.id === entry.studentId);
                                  return prof ? (
                                    <div>
                                      <div className="flex items-center gap-2 text-primary mb-2">
                                        <User size={14} />
                                        <h4 className="text-xs font-bold font-cinzel">DADOS PESSOAIS</h4>
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <Field label="Nome" value={prof.nome} />
                                        <Field label="Email" value={prof.email} />
                                        <Field label="Telefone" value={prof.telefone} />
                                        <Field label="CPF" value={prof.cpf} />
                                        <Field label="Sexo" value={prof.sexo} />
                                        <Field label="Nascimento" value={prof.nascimento} />
                                        <Field label="Faixa etária" value={prof.faixa_etaria} />
                                        <Field label="Peso" value={prof.peso ? `${prof.peso}kg` : null} />
                                        <Field label="Altura" value={prof.altura ? `${prof.altura}cm` : null} />
                                        <Field label="Meta de peso" value={prof.meta_peso ? `${prof.meta_peso}kg` : null} />
                                        <Field label="% Gordura" value={prof.body_fat != null ? `${prof.body_fat}%` : null} />
                                        <Field label="Cidade/Estado" value={prof.cidade_estado} />
                                        <Field label="Bairro" value={prof.bairro} />
                                        <Field label="Logradouro" value={prof.logradouro} />
                                        <Field label="CEP" value={prof.cep} />
                                        <Field label="Como chegou" value={prof.como_chegou} />
                                        <Field label="Tempo acompanha" value={prof.tempo_acompanha} />
                                        <Field label="Fatores de escolha" value={prof.fatores_escolha} />
                                        {prof.indicacao && <Field label="Indicação" value={prof.indicacao} />}
                                        {prof.indicacao_nome && <Field label="Nome indicação" value={prof.indicacao_nome} />}
                                        {prof.indicacao_telefone && <Field label="Tel. indicação" value={prof.indicacao_telefone} />}
                                      </div>
                                    </div>
                                  ) : null;
                                })()}

                                  <div>
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                      <Dumbbell size={14} />
                                      <h4 className="text-xs font-bold font-cinzel">PERFIL FÍSICO</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <Field label="Objetivo" value={anam.objetivo} />
                                      <Field label="Experiência" value={anam.experiencia_treino} />
                                      <Field label="Frequência" value={anam.frequencia_treino} />
                                      <Field label="Local" value={anam.local_treino} />
                                      <Field label="Equipamentos" value={anam.equipamentos} />
                                      <Field label="Lesões" value={anam.lesoes || "Nenhuma"} />
                                      <Field label="Disponibilidade" value={anam.disponibilidade_treino} />
                                      <Field label="Motivação" value={anam.motivacao} />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                      <Apple size={14} />
                                      <h4 className="text-xs font-bold font-cinzel">NUTRIÇÃO</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <Field label="Restrições" value={anam.restricoes_alimentares || "Nenhuma"} />
                                      <Field label="Dieta" value={anam.dieta_atual} />
                                      <Field label="Suplementos" value={anam.suplementos || "Nenhum"} />
                                      <Field label="Água diária" value={anam.agua_diaria} />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                      <Brain size={14} />
                                      <h4 className="text-xs font-bold font-cinzel">SAÚDE</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <Field label="Sono" value={anam.sono_horas} />
                                      <Field label="Estresse" value={anam.nivel_estresse} />
                                      <Field label="Condições" value={anam.condicoes_saude || "Nenhuma"} />
                                      <Field label="Medicamentos" value={anam.medicamentos || "Nenhum"} />
                                      <Field label="Ocupação" value={anam.ocupacao} />
                                    </div>
                                  </div>

                                  {/* Dados extras completos */}
                                  {anam.dados_extras && typeof anam.dados_extras === "object" && (() => {
                                    const extras = anam.dados_extras as Record<string, any>;
                                    const skipKeys = new Set(["fotos"]);
                                    const extraEntries = Object.entries(extras).filter(
                                      ([k, v]) => !skipKeys.has(k) && v !== null && v !== undefined && v !== ""
                                    );
                                    const photoEntries = extras.fotos && typeof extras.fotos === "object"
                                      ? Object.entries(extras.fotos as Record<string, string>)
                                      : [];

                                    if (extraEntries.length === 0 && photoEntries.length === 0) return null;

                                    const formatLabel = (key: string) =>
                                      key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

                                    const formatValue = (val: any): string => {
                                      if (Array.isArray(val)) return val.join(", ");
                                      if (typeof val === "object") return JSON.stringify(val);
                                      return String(val);
                                    };

                                    return (
                                      <>
                                        {extraEntries.length > 0 && (
                                          <div>
                                            <div className="flex items-center gap-2 text-primary mb-2">
                                              <ClipboardList size={14} />
                                              <h4 className="text-xs font-bold font-cinzel">DADOS COMPLEMENTARES</h4>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                              {extraEntries.map(([key, val]) => (
                                                <Field key={key} label={formatLabel(key)} value={formatValue(val)} />
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {photoEntries.length > 0 && (
                                          <div>
                                            <div className="flex items-center gap-2 text-primary mb-2">
                                              <User size={14} />
                                              <h4 className="text-xs font-bold font-cinzel">FOTOS</h4>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                              {photoEntries.map(([label, url]) => (
                                                <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                                  <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted">
                                                    <img src={url} alt={label} className="w-full h-full object-cover" />
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground mt-1 text-center capitalize">{label.replace(/_/g, " ")}</p>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </>
                              ) : (
                                <>
                                  <div>
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                      <Dumbbell size={14} />
                                      <h4 className="text-xs font-bold font-cinzel">AVALIAÇÃO</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <Field label="Peso" value={assess.peso ? `${assess.peso}kg` : null} />
                                      <Field label="Altura" value={assess.altura ? `${assess.altura}cm` : null} />
                                      <Field label="Objetivo atual" value={assess.objetivo_atual} />
                                      <Field label="Modalidade" value={assess.modalidade} />
                                      <Field label="Compromisso" value={assess.frequencia_compromisso} />
                                      <Field label="Fadiga (1-10)" value={assess.nivel_fadiga?.toString()} />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 text-primary mb-2">
                                      <Brain size={14} />
                                      <h4 className="text-xs font-bold font-cinzel">ADESÃO & PROGRESSO</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      <Field label="Adesão treinos" value={assess.adesao_treinos != null ? `${assess.adesao_treinos}%` : null} />
                                      <Field label="Adesão dieta" value={assess.adesao_dieta} />
                                      <Field label="Adesão cardio" value={assess.adesao_cardios != null ? `${assess.adesao_cardios}%` : null} />
                                      <Field label="Prioridades" value={assess.prioridades_fisicas} />
                                      <Field label="Notas progressão" value={assess.notas_progressao} />
                                    </div>
                                  </div>
                                  {(assess.sugestao_melhoria || assess.sugestao_dieta) && (
                                    <div>
                                      <div className="flex items-center gap-2 text-primary mb-2">
                                        <Apple size={14} />
                                        <h4 className="text-xs font-bold font-cinzel">SUGESTÕES DO ALUNO</h4>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {assess.sugestao_melhoria && <Field label="Melhoria treino" value={assess.sugestao_melhoria} />}
                                        {assess.sugestao_dieta && <Field label="Melhoria dieta" value={assess.sugestao_dieta} />}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAnamneses;
