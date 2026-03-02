import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  User, Camera, Dumbbell, TrendingUp, Target, Building2, CheckCircle2,
  Apple, ClipboardCheck, ChevronRight,
} from "lucide-react";
import InsanoLogo from "@/components/InsanoLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUploadField from "@/pages/onboarding/FileUploadField";
import CheckboxGroup from "@/pages/onboarding/CheckboxGroup";
import { useProfile } from "@/hooks/useProfile";
import { submitMonthlyAssessment } from "@/lib/submitMonthlyAssessment";
import { supabase } from "@/integrations/supabase/client";
import posturalFrenteCostas from "@/assets/postural-frente-costas.png";
import posturalPerfil from "@/assets/postural-perfil.png";
import posturalTeste from "@/assets/postural-teste.png";
import {
  type MonthlyStep, type MonthlyFormData,
  monthlySteps, monthlyStepLabels, initialMonthlyFormData,
  maquinasDisponiveis, diasSemana, frequenciaOpcoes, tempoTreinoOpcoes,
} from "./constants";

const MonthlyAssessment = () => {
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const [step, setStep] = useState<MonthlyStep>("dados");
  const [form, setForm] = useState<MonthlyFormData>({
    ...initialMonthlyFormData,
    altura: profile?.altura || "",
    peso: profile?.peso || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Pre-fill from last monthly assessment or anamnese
  useEffect(() => {
    if (prefilled) return;
    const prefillForm = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try last monthly assessment first
      const { data: lastAssessment } = await supabase
        .from("monthly_assessments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastAssessment) {
        setForm(prev => ({
          ...prev,
          modalidade: lastAssessment.modalidade || prev.modalidade,
          dias_disponiveis: lastAssessment.dias_disponiveis || prev.dias_disponiveis,
          frequencia_compromisso: lastAssessment.frequencia_compromisso || prev.frequencia_compromisso,
          tempo_disponivel: lastAssessment.tempo_disponivel || prev.tempo_disponivel,
          maquinas_indisponiveis: lastAssessment.maquinas_indisponiveis || prev.maquinas_indisponiveis,
          objetivo_atual: lastAssessment.objetivo_atual || prev.objetivo_atual,
          competicao_fisiculturismo: lastAssessment.competicao_fisiculturismo || prev.competicao_fisiculturismo,
          restricao_alimentar: lastAssessment.restricao_alimentar || prev.restricao_alimentar,
          alimentos_proibidos: lastAssessment.alimentos_proibidos || prev.alimentos_proibidos,
          refeicoes_horarios: lastAssessment.refeicoes_horarios || prev.refeicoes_horarios,
          horario_treino: lastAssessment.horario_treino || prev.horario_treino,
          horario_treino_outro: lastAssessment.horario_treino_outro || prev.horario_treino_outro,
          prioridades_fisicas: lastAssessment.prioridades_fisicas || prev.prioridades_fisicas,
        }));
        setPrefilled(true);
        return;
      }

      // Fallback: try anamnese
      const { data: anamnese } = await supabase
        .from("anamnese")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anamnese) {
        setForm(prev => ({
          ...prev,
          objetivo_atual: anamnese.objetivo || prev.objetivo_atual,
          restricao_alimentar: anamnese.restricoes_alimentares || prev.restricao_alimentar,
          tempo_disponivel: anamnese.disponibilidade_treino || prev.tempo_disponivel,
          frequencia_compromisso: anamnese.frequencia_treino || prev.frequencia_compromisso,
        }));
      }
      setPrefilled(true);
    };
    prefillForm();
  }, [prefilled]);

  const u = <K extends keyof MonthlyFormData>(field: K, value: MonthlyFormData[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const currentIdx = monthlySteps.indexOf(step);
  const nextStep = () => {
    if (currentIdx < monthlySteps.length - 1) setStep(monthlySteps[currentIdx + 1]);
  };
  const prevStep = () => {
    if (currentIdx > 0) setStep(monthlySteps[currentIdx - 1]);
  };

  const fc = "bg-card border-border text-foreground";
  const stepMotion = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.35 } };

  const AdvanceButton = ({ label = "AVANÇAR", onClick }: { label?: string; onClick?: () => void }) => (
    <div className="flex gap-3 mt-4">
      {currentIdx > 0 && (
        <motion.button whileTap={{ scale: 0.98 }} onClick={prevStep}
          className="px-6 py-3 border border-border text-muted-foreground font-cinzel font-bold rounded-lg tracking-wider">
          VOLTAR
        </motion.button>
      )}
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onClick || nextStep}
        className="flex-1 py-3 crimson-gradient text-foreground font-cinzel font-bold rounded-lg crimson-shadow tracking-wider">
        {label}
      </motion.button>
    </div>
  );

  const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
    <div className="text-center mb-4">
      <Icon className="mx-auto text-primary mb-2" size={32} />
      <h2 className="font-cinzel text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );

  const RadioOption = ({ field, value, label }: { field: keyof MonthlyFormData; value: string; label: string }) => (
    <button type="button" onClick={() => u(field, value as any)}
      className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
        form[field] === value
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
      }`}>
      {label}
    </button>
  );

  const ScoreSelector = ({ field, label }: { field: keyof MonthlyFormData; label: string }) => (
    <div>
      <Label className="text-muted-foreground text-xs">{label} <span className="text-primary">*</span></Label>
      <div className="flex gap-1 mt-1 flex-wrap">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" onClick={() => u(field, String(n) as any)}
            className={`w-9 h-9 rounded-lg border text-xs font-bold transition-all ${
              form[field] === String(n)
                ? "border-primary bg-primary/20 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await submitMonthlyAssessment(form);
    setIsSubmitting(false);
    if (result.success) {
      toast.success("Reavaliação mensal enviada com sucesso!");
      navigate("/");
    } else {
      toast.error(result.error || "Erro ao enviar reavaliação");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start p-4 marble-texture overflow-y-auto">
      {/* Stepper */}
      <div className="w-full max-w-lg mb-6 pt-2">
        <div className="flex items-center gap-0.5 mb-2">
          {monthlySteps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= currentIdx ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center font-cinzel tracking-widest">{monthlyStepLabels[step]}</p>
      </div>

      <AnimatePresence mode="wait">
        {/* DADOS BÁSICOS */}
        {step === "dados" && (
          <motion.div key="dados" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={User} title="Reavaliação Mensal" subtitle="Atualize seus dados básicos" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-muted-foreground text-xs">Altura (cm) <span className="text-primary">*</span></Label>
                  <Input type="number" className={fc} value={form.altura} onChange={(e) => u("altura", e.target.value)} placeholder="178" /></div>
                <div><Label className="text-muted-foreground text-xs">Peso atual (kg) <span className="text-primary">*</span></Label>
                  <Input type="number" className={fc} value={form.peso} onChange={(e) => u("peso", e.target.value)} placeholder="80" /></div>
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* FOTOS */}
        {step === "fotos" && (
          <motion.div key="fotos" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={Camera} title="Análise Postural" subtitle="Fotos do seu físico atual" />
            <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-2">
              <p>📸 As fotos deverão estar niveladas. Não force nenhuma postura.</p>
              <p>Apoie o celular em um tripé na altura entre o estômago e a cicatriz umbilical. Mostre corpo completo (pés à cabeça).</p>
              <p className="text-foreground font-semibold">Dica: Deixe o celular filmando e tire print nas posições.</p>
            </div>
            <div className="space-y-3">
              <img src={posturalFrenteCostas} alt="Exemplo frente e costas" className="max-w-[180px] mx-auto rounded-lg border border-border" />
              <div className="grid grid-cols-2 gap-3">
                <FileUploadField label="Frente" value={form.foto_frente} onChange={(f) => u("foto_frente", f)} required />
                <FileUploadField label="Costas" value={form.foto_costas} onChange={(f) => u("foto_costas", f)} required />
              </div>
            </div>
            <div className="space-y-3">
              <img src={posturalPerfil} alt="Exemplo perfil" className="max-w-[180px] mx-auto rounded-lg border border-border" />
              <div className="grid grid-cols-2 gap-3">
                <FileUploadField label="Lado Direito" value={form.foto_lado_direito} onChange={(f) => u("foto_lado_direito", f)} required />
                <FileUploadField label="Lado Esquerdo" value={form.foto_lado_esquerdo} onChange={(f) => u("foto_lado_esquerdo", f)} required />
              </div>
            </div>
            <div className="space-y-3">
              <img src={posturalTeste} alt="Teste de sentar e alcançar" className="max-w-[180px] mx-auto rounded-lg border border-border" />
              <FileUploadField label="Perfil (foto de lado)" value={form.foto_perfil_lado} onChange={(f) => u("foto_perfil_lado", f)} required />
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* MODALIDADE */}
        {step === "treino_modalidade" && (
          <motion.div key="treino_modalidade" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={Dumbbell} title="Modalidade & Fadiga" subtitle="Seu protocolo atual" />
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Modalidade esportiva <span className="text-primary">*</span></Label>
                <p className="text-[10px] text-muted-foreground mb-2">Precisa ser a mesma do formulário passado. Para migrar, contate o suporte.</p>
                <div className="space-y-2">
                  <RadioOption field="modalidade" value="musculacao" label="Musculação" />
                  <RadioOption field="modalidade" value="hibrido" label="Híbrido" />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Nível de fadiga <span className="text-primary">*</span></Label>
                <div className="space-y-2 mt-1">
                  {["0 → 100% disposto", "1 → Levemente cansado", "2 → Moderadamente cansado", "3 → Muito cansado", "4 → Super cansado"].map((label, i) => (
                    <RadioOption key={i} field="nivel_fadiga" value={String(i)} label={label} />
                  ))}
                </div>
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* PROGRESSÃO */}
        {step === "progressao" && (
          <motion.div key="progressao" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={TrendingUp} title="Progressão Muscular" subtitle="Está conseguindo progredir?" />
            <div className="space-y-3">
              {([
                { field: "progresso_peitoral" as const, label: "Peitoral" },
                { field: "progresso_costas" as const, label: "Costas" },
                { field: "progresso_deltoide" as const, label: "Deltóide (ombro)" },
                { field: "progresso_triceps" as const, label: "Tríceps" },
                { field: "progresso_biceps" as const, label: "Bíceps" },
                { field: "progresso_quadriceps" as const, label: "Quadríceps" },
                { field: "progresso_posteriores" as const, label: "Posteriores de coxa" },
                { field: "progresso_gluteos" as const, label: "Glúteos" },
                { field: "progresso_panturrilha" as const, label: "Panturrilha" },
              ]).map(({ field, label }) => (
                <div key={field} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                  <span className="text-sm text-foreground">{label}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => u(field, "sim")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all ${form[field] === "sim" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-card border border-border text-muted-foreground"}`}>Sim</button>
                    <button type="button" onClick={() => u(field, "nao")}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all ${form[field] === "nao" ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-card border border-border text-muted-foreground"}`}>Não</button>
                  </div>
                </div>
              ))}

              {/* Abdomen - 3 options */}
              <div className="bg-card border border-border rounded-lg px-4 py-3">
                <span className="text-sm text-foreground">Abdômen (com sobrecarga)</span>
                <div className="flex gap-2 mt-2">
                  {[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }, { v: "nao_tenho", l: "Não tenho exercício com sobrecarga" }].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => u("progresso_abdomen", v)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all ${form.progresso_abdomen === v ? "bg-primary/20 text-primary border border-primary/40" : "bg-card border border-border text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Antebraço - 3 options */}
              <div className="bg-card border border-border rounded-lg px-4 py-3">
                <span className="text-sm text-foreground">Antebraço (isolado)</span>
                <div className="flex gap-2 mt-2">
                  {[{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }, { v: "nao_tenho", l: "Não tenho exercício isolado" }].map(({ v, l }) => (
                    <button key={v} type="button" onClick={() => u("progresso_antebraco", v)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-all ${form.progresso_antebraco === v ? "bg-primary/20 text-primary border border-primary/40" : "bg-card border border-border text-muted-foreground"}`}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Se não progrediu em algum exercício, descreva: <span className="text-primary">*</span></Label>
                <Textarea className={fc} value={form.notas_progressao} onChange={(e) => u("notas_progressao", e.target.value)} placeholder="Descreva os pontos..." rows={3} />
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* PRIORIDADES */}
        {step === "prioridades" && (
          <motion.div key="prioridades" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={Target} title="Prioridades" subtitle="Pontos que deseja melhorar" />
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">
                  Quais pontos você gostaria de melhorar? Tem algum grupo muscular prioritário? <span className="text-primary">*</span>
                </Label>
                <Textarea className={fc} value={form.prioridades_fisicas} onChange={(e) => u("prioridades_fisicas", e.target.value)}
                  placeholder="Descreva suas prioridades de desenvolvimento..." rows={4} />
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* DISPONIBILIDADE */}
        {step === "disponibilidade" && (
          <motion.div key="disponibilidade" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={Dumbbell} title="Disponibilidade" subtitle="Dias e tempo para treinar" />
            <div className="space-y-4">
              <CheckboxGroup label="Dias disponíveis para treinar *" options={diasSemana} value={form.dias_disponiveis}
                onChange={(v) => u("dias_disponiveis", v)} columns={2} />
              <div>
                <Label className="text-muted-foreground text-xs">Frequência de compromisso <span className="text-primary">*</span></Label>
                <Select value={form.frequencia_compromisso} onValueChange={(v) => u("frequencia_compromisso", v)}>
                  <SelectTrigger className={fc}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{frequenciaOpcoes.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Tempo disponível para treinar <span className="text-primary">*</span></Label>
                <Select value={form.tempo_disponivel} onValueChange={(v) => u("tempo_disponivel", v)}>
                  <SelectTrigger className={fc}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{tempoTreinoOpcoes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* EQUIPAMENTOS */}
        {step === "equipamentos" && (
          <motion.div key="equipamentos" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={Building2} title="Equipamentos" subtitle="Máquinas que NÃO tem na sua academia" />
            <CheckboxGroup label="Selecione as que NÃO tem *" options={maquinasDisponiveis} value={form.maquinas_indisponiveis}
              onChange={(v) => u("maquinas_indisponiveis", v)} columns={1} />
            <AdvanceButton />
          </motion.div>
        )}

        {/* ADESÃO */}
        {step === "adesao" && (
          <motion.div key="adesao" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={ClipboardCheck} title="Adesão" subtitle="Como foi sua adesão no último mês?" />
            <div className="space-y-4">
              <ScoreSelector field="adesao_treinos" label="De 0 a 10, quanto seguiu os treinos?" />
              {form.adesao_treinos && parseInt(form.adesao_treinos) < 8 && (
                <div><Label className="text-muted-foreground text-xs">Por qual motivo?</Label>
                  <Textarea className={fc} value={form.motivo_adesao_treinos} onChange={(e) => u("motivo_adesao_treinos", e.target.value)} rows={2} /></div>
              )}

              <ScoreSelector field="adesao_cardios" label="De 0 a 10, quanto seguiu os cárdios?" />
              {form.adesao_cardios && parseInt(form.adesao_cardios) < 8 && (
                <div><Label className="text-muted-foreground text-xs">Por qual motivo?</Label>
                  <Textarea className={fc} value={form.motivo_adesao_cardios} onChange={(e) => u("motivo_adesao_cardios", e.target.value)} rows={2} /></div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs">Realizou os alongamentos corretamente?</Label>
                <div className="flex gap-2 mt-1">
                  <RadioOption field="alongamentos_corretos" value="sim" label="Sim" />
                  <RadioOption field="alongamentos_corretos" value="nao" label="Não" />
                </div>
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* DIETA */}
        {step === "dieta" && (
          <motion.div key="dieta" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={Apple} title="Dieta & Objetivos" subtitle="Alimentação e metas atuais" />
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Quantas refeições e horários? <span className="text-primary">*</span></Label>
                <div className="space-y-2 mt-1">
                  <RadioOption field="refeicoes_horarios" value="mesmos" label="Os mesmos do protocolo anterior" />
                  <RadioOption field="refeicoes_horarios" value="outro" label="Outro" />
                </div>
                {form.refeicoes_horarios === "outro" && (
                  <Textarea className={`${fc} mt-2`} value={form.refeicoes_horarios_outro} onChange={(e) => u("refeicoes_horarios_outro", e.target.value)} placeholder="Descreva..." rows={2} />
                )}
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Horário de treino <span className="text-primary">*</span></Label>
                <div className="space-y-2 mt-1">
                  <RadioOption field="horario_treino" value="mesmos" label="Os mesmos do protocolo anterior" />
                  <RadioOption field="horario_treino" value="outro" label="Outro" />
                </div>
                {form.horario_treino === "outro" && (
                  <Input className={`${fc} mt-2`} value={form.horario_treino_outro} onChange={(e) => u("horario_treino_outro", e.target.value)} placeholder="Qual horário?" />
                )}
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Objetivo atual <span className="text-primary">*</span></Label>
                <div className="space-y-2 mt-1">
                  <RadioOption field="objetivo_atual" value="perda_gordura" label="Perda de gordura" />
                  <RadioOption field="objetivo_atual" value="ganho_massa" label="Ganho de massa muscular" />
                  <RadioOption field="objetivo_atual" value="profissionais" label="Deixo para os profissionais avaliarem" />
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Pretende competir em fisiculturismo natural? <span className="text-primary">*</span></Label>
                <Textarea className={fc} value={form.competicao_fisiculturismo} onChange={(e) => u("competicao_fisiculturismo", e.target.value)}
                  placeholder="Se sim, qual categoria e quanto tempo..." rows={2} />
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Restrição alimentar? <span className="text-primary">*</span></Label>
                <Input className={fc} value={form.restricao_alimentar} onChange={(e) => u("restricao_alimentar", e.target.value)} placeholder="Intolerância/alergia..." />
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">Alimentos que não come de jeito nenhum <span className="text-primary">*</span></Label>
                <Textarea className={fc} value={form.alimentos_proibidos} onChange={(e) => u("alimentos_proibidos", e.target.value)} rows={2} />
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">No último mês referente à dieta <span className="text-primary">*</span></Label>
                <div className="space-y-2 mt-1">
                  <RadioOption field="adesao_dieta" value="100%" label="Segui 100%" />
                  <RadioOption field="adesao_dieta" value="80%" label="Segui 80%" />
                  <RadioOption field="adesao_dieta" value="50%" label="Segui 50%" />
                  <RadioOption field="adesao_dieta" value="nao_consegui" label="Não consegui seguir" />
                </div>
              </div>

              {form.adesao_dieta && form.adesao_dieta !== "100%" && (
                <div>
                  <Label className="text-muted-foreground text-xs">Motivo:</Label>
                  <div className="space-y-2 mt-1">
                    <RadioOption field="motivo_nao_dieta" value="falta_organizacao" label="Falta de organização minha" />
                    <RadioOption field="motivo_nao_dieta" value="nao_adaptei" label="Não me adaptei a alguns alimentos" />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground text-xs">Sugestão para facilitar a adesão à dieta <span className="text-primary">*</span></Label>
                <Textarea className={fc} value={form.sugestao_dieta} onChange={(e) => u("sugestao_dieta", e.target.value)} rows={2} />
              </div>
            </div>
            <AdvanceButton />
          </motion.div>
        )}

        {/* FINALIZAÇÃO */}
        {step === "finalizacao" && (
          <motion.div key="finalizacao" {...stepMotion} className="max-w-lg w-full space-y-5 pb-8">
            <SectionHeader icon={CheckCircle2} title="Finalização" subtitle="Últimas perguntas" />
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Autoriza publicar sua evolução (preservando o rosto)?</Label>
                <div className="flex gap-2 mt-1">
                  <RadioOption field="autoriza_publicacao" value="sim" label="Sim" />
                  <RadioOption field="autoriza_publicacao" value="nao" label="Não" />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Sugestão de melhoria</Label>
                <Textarea className={fc} value={form.sugestao_melhoria} onChange={(e) => u("sugestao_melhoria", e.target.value)}
                  placeholder="Alguma sugestão para melhorarmos?" rows={3} />
              </div>
            </div>
            <AdvanceButton label={isSubmitting ? "ENVIANDO..." : "ENVIAR REAVALIAÇÃO"} onClick={handleSubmit} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MonthlyAssessment;
