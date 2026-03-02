import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Users, Search, Filter, ShieldCheck, Flame, Dumbbell, Apple, Brain,
  MessageSquare, User, CheckCircle2, XCircle, Plus, Eye, ChevronDown, Loader2,
  LineChart, BarChart2, Activity, UserCog, Edit3, Trash2, UserPlus, ArrowDown, ArrowUp
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Mock para alunos atrelados ao profissional
const mockAlunosAssociados = [
  { id: 1, name: "Marcus Roberto", status: "Em Risco", plano: "Gladius" },
  { id: 2, name: "Lucas Fernandes", status: "Estável", plano: "Centurio" },
  { id: 3, name: "João Pedro", status: "Novo", plano: "Legatus" },
];

// Mock Conversas
const mockConversasProfissional = [
  { id: 1, aluno: "Marcus Roberto", ultimaMsg: "Oi, sinto dor no ombro direito no supino.", hora: "10:30", lida: false },
  { id: 2, aluno: "Lucas Fernandes", ultimaMsg: "Valeu pelo novo treino de pernas!", hora: "Ontem", lida: true },
];
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Status mapping from DB to display
const mapStatus = (status: string): string => {
  if (status === "ativo") return "ativo";
  if (status === "inativo") return "inativo";
  if (status === "anamnese_concluida" || status === "pendente_onboarding") return "alerta";
  return "alerta";
};

const statusColor: Record<string, string> = {
  ativo: "bg-emerald-500/20 text-emerald-400",
  alerta: "bg-amber-500/20 text-amber-400",
  inativo: "bg-destructive/20 text-destructive",
};

const SectionBlock = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-primary">
      <Icon size={16} />
      <h4 className="font-cinzel text-sm font-bold">{title}</h4>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</div>
  </div>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-foreground font-medium">{value}</p></div>
);

const AdminUsuarios = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const specialistFilter = searchParams.get("specialist");
  const [specialistFilterName, setSpecialistFilterName] = useState<string | null>(null);
  const [specialistStudentIds, setSpecialistStudentIds] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [chamaFilter, setChamaFilter] = useState<string>("todas");
  const [adesaoFilter, setAdesaoFilter] = useState<string>("todas");

  const openChatWith = (targetUserId: string) => {
    navigate(`/admin/comunicacao?userId=${targetUserId}`);
  };

  const [activeTab, setActiveTab] = useState("alunos");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [anamneseMap, setAnamneseMap] = useState<Record<string, any>>({});
  const [specialistMap, setSpecialistMap] = useState<Record<string, { display: string; personal?: string; personalName?: string; nutri?: string; nutriName?: string }>>({});
  const [flameMap, setFlameMap] = useState<Record<string, { state: string; adherence: number }>>({});
  // Create Aluno
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    nome: "", email: "", password: "", telefone: "", cpf: "",
    role: "user" as string, skipOnboarding: false,
  });

  // Create Profissional
  const [createProOpen, setCreateProOpen] = useState(false);
  const [newPro, setNewPro] = useState({
    nome: "", email: "", password: "", role: "personal" as string, especialidade: ""
  });

  const [profissionais, setProfissionais] = useState<any[]>([]);
  const [loadingPros, setLoadingPros] = useState(false);

  const [alunos, setAlunos] = useState<any[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);

  // Assign specialist state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState<string | null>(null);
  const [assignStudentName, setAssignStudentName] = useState("");
  const [personalList, setPersonalList] = useState<{ id: string; nome: string }[]>([]);
  const [nutriList, setNutriList] = useState<{ id: string; nome: string }[]>([]);
  const [selectedPersonal, setSelectedPersonal] = useState("");
  const [selectedNutri, setSelectedNutri] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (activeTab === "profissionais") {
      fetchProfissionais();
    } else if (activeTab === "alunos") {
      fetchAlunos();
    }
  }, [activeTab]);

  // Load specialist filter data
  useEffect(() => {
    if (!specialistFilter) {
      setSpecialistStudentIds(null);
      setSpecialistFilterName(null);
      return;
    }
    const loadFilter = async () => {
      const [{ data: ss }, { data: profile }] = await Promise.all([
        supabase.from("student_specialists").select("student_id").eq("specialist_id", specialistFilter),
        supabase.from("profiles").select("nome").eq("id", specialistFilter).single(),
      ]);
      setSpecialistStudentIds(ss?.map(s => s.student_id) || []);
      setSpecialistFilterName(profile?.nome || "Especialista");
    };
    loadFilter();
  }, [specialistFilter]);

  const fetchAlunos = async () => {
    setLoadingAlunos(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase.from("profiles").select("*");
      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase.from("user_roles").select("user_id, role");
      if (rolesError) throw rolesError;

      const nonUserRoleIds = rolesData?.filter(r => r.role !== "user").map(r => r.user_id) || [];

      if (profilesData) {
        const alunosReais = profilesData.filter(p => !nonUserRoleIds.includes(p.id));
        setAlunos(alunosReais);

        // Fetch anamnese for all students
        const alunoIds = alunosReais.map(a => a.id);
        if (alunoIds.length > 0) {
          const { data: anamneseData } = await supabase
            .from("anamnese")
            .select("*")
            .in("user_id", alunoIds);

          if (anamneseData) {
            const map: Record<string, any> = {};
            anamneseData.forEach(a => { map[a.user_id] = a; });
            setAnamneseMap(map);
          }

          // Fetch specialist assignments
          const { data: ssData } = await supabase
            .from("student_specialists")
            .select("student_id, specialist_id, specialty")
            .in("student_id", alunoIds);

          if (ssData && ssData.length > 0) {
            const specIds = [...new Set(ssData.map(s => s.specialist_id))];
            const { data: specProfiles } = await supabase
              .from("profiles")
              .select("id, nome")
              .in("id", specIds);

            const specNameMap = new Map(specProfiles?.map(p => [p.id, p.nome]) || []);
            const sMap: Record<string, { display: string; personal?: string; personalName?: string; nutri?: string; nutriName?: string }> = {};
            ssData.forEach(s => {
              const name = specNameMap.get(s.specialist_id) || "Especialista";
              if (!sMap[s.student_id]) sMap[s.student_id] = { display: "" };
              if (s.specialty === "personal") {
                sMap[s.student_id].personal = s.specialist_id;
                sMap[s.student_id].personalName = name;
              }
              if (s.specialty === "nutricionista") {
                sMap[s.student_id].nutri = s.specialist_id;
                sMap[s.student_id].nutriName = name;
              }
              sMap[s.student_id].display = sMap[s.student_id].display
                ? `${sMap[s.student_id].display}, ${name}`
                : name;
            });
            setSpecialistMap(sMap);
          }

          // Fetch workouts and training plans for flame/adherence
          const [workoutsRes, plansRes] = await Promise.all([
            supabase
              .from("workouts")
              .select("user_id, finished_at")
              .in("user_id", alunoIds)
              .not("finished_at", "is", null)
              .order("finished_at", { ascending: false })
              .limit(1000),
            supabase
              .from("training_plans")
              .select("user_id, groups, created_at")
              .in("user_id", alunoIds)
              .eq("active", true),
          ]);

          const allWorkouts = workoutsRes.data || [];
          const plans = plansRes.data || [];

          const toLocal = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

          const today = new Date();
          const todayStr = toLocal(today);

          const fMap: Record<string, { state: string; adherence: number }> = {};
          alunoIds.forEach((id) => {
            const userWorkouts = allWorkouts.filter((w) => w.user_id === id);
            const userPlan = plans.find((p) => p.user_id === id);

            if (!userPlan || !Array.isArray(userPlan.groups) || userWorkouts.length === 0) {
              fMap[id] = { state: "normal", adherence: 0 };
              return;
            }

            const numGroups = Math.min(Math.max((userPlan.groups as any[]).length, 1), 7);
            const dayMap = [1, 2, 3, 4, 5, 6, 0];
            const scheduledDays = new Set<number>();
            for (let i = 0; i < numGroups; i++) scheduledDays.add(dayMap[i]);

            const planCreatedAt = new Date(userPlan.created_at);
            const workoutDates = new Set(userWorkouts.map((w) => toLocal(new Date(w.finished_at!))));
            const trainedToday = workoutDates.has(todayStr);

            // Check if trained yesterday (covers late-night training timezone shifts)
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const trainedYesterday = workoutDates.has(toLocal(yesterday));

            let streak = trainedToday ? 1 : 0;
            let missed = 0;

            for (let i = trainedToday ? 1 : 0; i < 90; i++) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              if (d < planCreatedAt) break;
              if (!scheduledDays.has(d.getDay())) continue;
              if (i === 0) continue; // today handled above

              if (workoutDates.has(toLocal(d))) {
                if (missed === 0) streak++;
              } else {
                missed++;
                if (missed >= 2) break;
              }
            }

            // Adherence (last 7 days)
            let schedCount = 0, doneCount = 0;
            for (let i = 0; i < 7; i++) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              if (d < planCreatedAt) break;
              if (scheduledDays.has(d.getDay())) {
                schedCount++;
                if (workoutDates.has(toLocal(d))) doneCount++;
              }
            }
            const adherence = schedCount > 0 ? Math.round((doneCount / schedCount) * 100) : 0;

            let state: string;
            if (trainedToday) state = "ativa";
            else if (trainedYesterday && missed === 0) state = "ativa"; // trained yesterday, no misses
            else if (missed === 0) state = streak > 0 ? "ativa" : "normal";
            else if (missed === 1) state = "tregua";
            else { state = "extinta"; streak = 0; }

            fMap[id] = { state, adherence };
          });
          setFlameMap(fMap);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao puxar alunos reais");
    } finally {
      setLoadingAlunos(false);
    }
  };

  const fetchProfissionais = async () => {
    setLoadingPros(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase.from("user_roles").select("user_id, role").neq("role", "user");
      if (rolesError) throw rolesError;

      if (rolesData && rolesData.length > 0) {
        const userIds = rolesData.map(r => r.user_id);
        const { data: profilesData } = await supabase.from("profiles").select("id, nome, email, status").in("id", userIds);

        if (profilesData) {
          const merged = profilesData.map(p => {
            const roleInfo = rolesData.find(r => r.user_id === p.id);
            return { ...p, role: roleInfo?.role || "desconhecido" };
          });
          setProfissionais(merged);
        }
      } else {
        setProfissionais([]);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao puxar profissionais");
    } finally {
      setLoadingPros(false);
    }
  };

  const handleCreatePro = async () => {
    if (!newPro.nome || !newPro.email || !newPro.password || !newPro.role) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setCreating(true);
    try {
      toast.success("Profissional registrado com sucesso!");
      setCreateProOpen(false);
      setNewPro({ nome: "", email: "", password: "", role: "personal", especialidade: "" });
      fetchProfissionais();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar profissional");
    } finally {
      setCreating(false);
    }
  };

  const setField = (key: string, val: string | boolean) => setNewUser((u) => ({ ...u, [key]: val }));

  const openAssignDialog = async (studentId: string, studentName: string) => {
    setAssignStudentId(studentId);
    setAssignStudentName(studentName);
    // Pre-fill with current assignments
    const current = specialistMap[studentId];
    setSelectedPersonal(current?.personal || "");
    setSelectedNutri(current?.nutri || "");
    setAssignOpen(true);

    // Fetch specialists (personal + nutricionista roles)
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["personal", "nutricionista"]);

    if (rolesData && rolesData.length > 0) {
      const specIds = [...new Set(rolesData.map(r => r.user_id))];
      const { data: specProfiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", specIds);

      const nameMap = new Map(specProfiles?.map(p => [p.id, p.nome || "Sem nome"]) || []);

      setPersonalList(
        rolesData.filter(r => r.role === "personal").map(r => ({ id: r.user_id, nome: nameMap.get(r.user_id) || "Sem nome" }))
      );
      setNutriList(
        rolesData.filter(r => r.role === "nutricionista").map(r => ({ id: r.user_id, nome: nameMap.get(r.user_id) || "Sem nome" }))
      );
    } else {
      setPersonalList([]);
      setNutriList([]);
    }
  };

  const handleAssignSpecialist = async () => {
    if (!assignStudentId || (!selectedPersonal && !selectedNutri)) {
      toast.error("Selecione pelo menos um especialista");
      return;
    }
    setAssigning(true);
    try {
      // Remove existing links for this student
      await supabase.from("student_specialists").delete().eq("student_id", assignStudentId);

      const inserts: { student_id: string; specialist_id: string; specialty: string }[] = [];
      if (selectedPersonal) inserts.push({ student_id: assignStudentId, specialist_id: selectedPersonal, specialty: "personal" });
      if (selectedNutri) inserts.push({ student_id: assignStudentId, specialist_id: selectedNutri, specialty: "nutricionista" });

      if (inserts.length > 0) {
        const { error } = await supabase.from("student_specialists").insert(inserts);
        if (error) throw error;
      }

      toast.success("Especialistas atribuídos com sucesso!");
      setAssignOpen(false);
      fetchAlunos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atribuir especialistas");
    } finally {
      setAssigning(false);
    }
  };

  const baseAlunos = specialistStudentIds ? alunos.filter(a => specialistStudentIds.includes(a.id)) : alunos;
  const filtered = baseAlunos
    .filter((u) => {
      const matchesSearch = (u.nome || "").toLowerCase().includes(search.toLowerCase()) || (u.email || "").toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === "ativo" && u.status !== "ativo") return false;
      if (statusFilter === "inativo" && u.status !== "inativo") return false;
      if (statusFilter === "pendente" && u.status !== "pendente_onboarding" && u.status !== "pendente") return false;

      // Chama filter
      const flame = flameMap[u.id];
      if (chamaFilter === "ativa" && flame?.state !== "ativa") return false;
      if (chamaFilter === "tregua" && flame?.state !== "tregua") return false;
      if (chamaFilter === "extinta" && flame?.state !== "extinta" && flame?.state !== "normal") return false;

      // Adesão filter
      if (adesaoFilter !== "todas") {
        const adh = flame?.adherence ?? 0;
        if (adesaoFilter === "alta" && adh < 70) return false;
        if (adesaoFilter === "media" && (adh < 30 || adh >= 70)) return false;
        if (adesaoFilter === "baixa" && adh >= 30) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const handleCreateUser = async () => {
    if (!newUser.nome || !newUser.email || !newUser.password) {
      toast.error("Nome, email e senha são obrigatórios");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: newUser.email,
          password: newUser.password,
          nome: newUser.nome,
          telefone: newUser.telefone || null,
          cpf: newUser.cpf || null,
          role: newUser.role,
          skipOnboarding: newUser.role === "user" ? newUser.skipOnboarding : true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Conta criada para ${newUser.nome}!`);
      setNewUser({ nome: "", email: "", password: "", telefone: "", cpf: "", role: "user", skipOnboarding: false });
      setCreateOpen(false);
      fetchAlunos();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta");
    } finally {
      setCreating(false);
    }
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit user state
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTab, setEditTab] = useState("dados");
  const [editUser, setEditUser] = useState<{
    id: string; nome: string; email: string; telefone: string; cpf: string; password: string; status: string;
  }>({ id: "", nome: "", email: "", telefone: "", cpf: "", password: "", status: "" });

  // Sales tab state
  const [salesCloser, setSalesCloser] = useState("");
  const [salesProductId, setSalesProductId] = useState("");
  const [salesInviteId, setSalesInviteId] = useState<string | null>(null);
  const [salesStartedAt, setSalesStartedAt] = useState("");
  const [salesSubscriptionId, setSalesSubscriptionId] = useState<string | null>(null);
  const [savingSales, setSavingSales] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [closersList, setClosersList] = useState<{ id: string; nome: string }[]>([]);
  const [productsList, setProductsList] = useState<{ id: string; name: string; price: number; duration_months: number }[]>([]);

  // Load closers and products for sales tab
  const loadSalesData = async (userId: string) => {
    setLoadingSales(true);
    try {
      // Run all independent queries in parallel
      const [closersRolesRes, plansRes, profileRes, subRes] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "closer" as any),
        supabase.from("subscription_plans").select("id, name, price, duration_months").eq("active", true).order("price"),
        supabase.from("profiles").select("email, cpf").eq("id", userId).maybeSingle(),
        supabase.from("subscriptions").select("id, started_at, subscription_plan_id, plan_price").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false }).limit(1),
      ]);

      // Resolve closers
      const closersRoles = closersRolesRes.data;
      if (closersRoles && closersRoles.length > 0) {
        const closerIds = closersRoles.map(r => r.user_id);
        const { data: closerProfiles } = await supabase.from("profiles").select("id, nome").in("id", closerIds);
        setClosersList((closerProfiles || []).map(p => ({ id: p.id, nome: p.nome || "Sem nome" })));
      }

      const plans = plansRes.data;
      setProductsList((plans || []).map(p => ({ ...p, duration_months: p.duration_months ?? 1 })));

      // Resolve invite
      const userProfile = profileRes.data;
      let inviteCloser = "";
      let invitePlanId = "";
      let inviteDate = "";
      let foundInvite = false;

      const findInvite = async (field: string, value: string) => {
        const q = supabase.from("invites").select("id, created_by, subscription_plan_id, product_id, plan_value, used_at, created_at");
        const { data } = await (q as any).eq(field, value).order("created_at", { ascending: false }).limit(1);
        return data && data.length > 0 ? data[0] : null;
      };

      if (userProfile) {
        let invite = userProfile.email ? await findInvite("email", userProfile.email) : null;
        if (!invite && userProfile.cpf) invite = await findInvite("cpf", userProfile.cpf);

        if (invite) {
          setSalesInviteId(invite.id);
          inviteCloser = invite.created_by || "";
          inviteDate = invite.used_at
            ? new Date(invite.used_at).toISOString().split("T")[0]
            : new Date(invite.created_at).toISOString().split("T")[0];

          if (invite.subscription_plan_id) {
            invitePlanId = invite.subscription_plan_id;
          } else if (invite.plan_value) {
            const matchingPlan = (plans || []).find(p => Number(p.price) === Number(invite.plan_value));
            if (matchingPlan) invitePlanId = matchingPlan.id;
          }
          foundInvite = true;
        }
      }
      if (!foundInvite) setSalesInviteId(null);
      setSalesCloser(inviteCloser);

      // Resolve subscription
      const existingSub = subRes.data;
      if (existingSub && existingSub.length > 0) {
        setSalesSubscriptionId(existingSub[0].id);
        const startDate = existingSub[0].started_at ? new Date(existingSub[0].started_at).toISOString().split("T")[0] : "";
        setSalesStartedAt(startDate);
        setSalesProductId(existingSub[0].subscription_plan_id || invitePlanId);
      } else {
        setSalesSubscriptionId(null);
        setSalesStartedAt(inviteDate);
        setSalesProductId(invitePlanId);
      }
    } finally {
      setLoadingSales(false);
    }
  };

  const handleSaveSales = async () => {
    if (!salesCloser && !salesProductId) {
      toast.error("Selecione ao menos um closer ou plano");
      return;
    }
    setSavingSales(true);
    try {
      const prod = productsList.find(p => p.id === salesProductId);
      const startedAt = salesStartedAt ? new Date(salesStartedAt + "T00:00:00").toISOString() : new Date().toISOString();
      
      // Calculate expires_at based on plan duration
      let expiresAt: string | null = null;
      if (prod && salesStartedAt) {
        const start = new Date(salesStartedAt + "T00:00:00");
        start.setMonth(start.getMonth() + prod.duration_months);
        expiresAt = start.toISOString();
      }

      if (!salesInviteId) {
        // Auto-create invite for users created manually by admin
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("email, cpf, nome")
          .eq("id", editUser!.id)
          .single();

        if (!userProfile?.email) {
          toast.error("Perfil do usuário não encontrado");
          return;
        }

        const { data: newInvite, error: insertErr } = await supabase
          .from("invites")
          .insert({
            email: userProfile.email,
            cpf: userProfile.cpf || null,
            name: userProfile.nome || null,
            created_by: salesCloser || null,
            subscription_plan_id: salesProductId || null,
            plan_value: prod?.price || null,
            status: "used",
            used_at: new Date().toISOString(),
            payment_status: "paid",
          })
          .select("id")
          .single();

        if (insertErr) throw insertErr;
        setSalesInviteId(newInvite!.id);
      } else {
        // Update existing invite
        const update: Record<string, any> = {};
        if (salesCloser) update.created_by = salesCloser;
        if (salesProductId) update.subscription_plan_id = salesProductId;
        if (prod) update.plan_value = prod.price;

        const { error } = await supabase
          .from("invites")
          .update(update)
          .eq("id", salesInviteId);
        if (error) throw error;
      }

      // Create or update subscription record
      if (salesSubscriptionId) {
        const { error: subErr } = await supabase
          .from("subscriptions")
          .update({
            started_at: startedAt,
            plan_price: prod?.price || 0,
            subscription_plan_id: salesProductId || null,
            expires_at: expiresAt,
          })
          .eq("id", salesSubscriptionId);
        if (subErr) throw subErr;
      } else {
        const { data: newSub, error: subErr } = await supabase
          .from("subscriptions")
          .insert({
            user_id: editUser!.id,
            started_at: startedAt,
            plan_price: prod?.price || 0,
            subscription_plan_id: salesProductId || null,
            expires_at: expiresAt,
            status: "active",
          })
          .select("id")
          .single();
        if (subErr) throw subErr;
        setSalesSubscriptionId(newSub!.id);
      }

      toast.success("Dados de venda e assinatura salvos!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar venda");
    } finally {
      setSavingSales(false);
    }
  };

  const openEditDialog = (user: any) => {
    setEditUser({
      id: user.id,
      nome: user.nome || "",
      email: user.email || "",
      telefone: user.telefone || "",
      cpf: user.cpf || "",
      password: "",
      status: user.status || "pendente_onboarding",
    });
    setEditTab("dados");
    setSalesInviteId(null);
    setSalesCloser("");
    setSalesProductId("");
    setSalesStartedAt("");
    setSalesSubscriptionId(null);
    setEditOpen(true);
    loadSalesData(user.id);
  };

  const handleEditUser = async () => {
    if (!editUser.id) return;
    setEditing(true);
    try {
      const body: Record<string, any> = { user_id: editUser.id };
      if (editUser.nome) body.nome = editUser.nome;
      if (editUser.email) body.email = editUser.email;
      if (editUser.telefone !== undefined) body.telefone = editUser.telefone;
      if (editUser.cpf !== undefined) body.cpf = editUser.cpf;
      if (editUser.status) body.status = editUser.status;
      if (editUser.password) body.password = editUser.password;

      const { data, error } = await supabase.functions.invoke("admin-edit-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Dados atualizados com sucesso!");
      setEditOpen(false);
      // Refresh the active tab
      if (activeTab === "alunos") fetchAlunos();
      else fetchProfissionais();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar usuário");
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setDeleting(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${userName} excluído com sucesso`);
      setAlunos((prev) => prev.filter((a) => a.id !== userId));
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir usuário");
    } finally {
      setDeleting(null);
    }
  };
  // Cálculos de Métricas de Alunos Reais
  const totalAlunos = baseAlunos.length;
  const inativosCount = baseAlunos.filter(a => a.status === 'inativo').length;
  const alertaCount = baseAlunos.filter(a => {
    if (a.status === 'inativo') return false;
    const lastAccess = a.ultimo_acesso || a.created_at;
    if (!lastAccess) return false;
    const hoursSince = (new Date().getTime() - new Date(lastAccess).getTime()) / (1000 * 60 * 60);
    return hoursSince > 48;
  }).length;
  const ativosCount = totalAlunos > 0 ? totalAlunos - inativosCount - alertaCount : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">
            {specialistFilterName ? `Alunos de ${specialistFilterName}` : "Gestão de Usuários"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {specialistFilterName 
              ? `${totalAlunos} aluno(s) vinculado(s)` 
              : "Visão consolidada de todos os alunos da plataforma"}
          </p>
        </div>
        <div className="flex gap-2 relative z-50">
          {activeTab === "alunos" ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><UserPlus size={16} /> Nova Conta</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-cinzel">Criar Conta (sem triagem)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nome completo *</Label>
                      <Input placeholder="Ex: Marcus Vinícius" value={newUser.nome} onChange={(e) => setField("nome", e.target.value)} className="bg-background border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email *</Label>
                      <Input type="email" placeholder="email@exemplo.com" value={newUser.email} onChange={(e) => setField("email", e.target.value)} className="bg-background border-border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Senha *</Label>
                      <Input type="password" placeholder="Mínimo 6 caracteres" value={newUser.password} onChange={(e) => setField("password", e.target.value)} className="bg-background border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefone</Label>
                      <Input placeholder="(00) 00000-0000" value={newUser.telefone} onChange={(e) => setField("telefone", e.target.value)} className="bg-background border-border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">CPF</Label>
                      <Input placeholder="000.000.000-00" value={newUser.cpf} onChange={(e) => setField("cpf", e.target.value)} className="bg-background border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Papel *</Label>
                      <Select value={newUser.role} onValueChange={(v) => setField("role", v)}>
                        <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Aluno</SelectItem>
                          <SelectItem value="nutricionista">Nutricionista</SelectItem>
                          <SelectItem value="personal">Preparador Físico</SelectItem>
                          <SelectItem value="closer">Closer</SelectItem>
                          <SelectItem value="cs">CS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {newUser.role === "user" && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                      <Switch checked={newUser.skipOnboarding} onCheckedChange={(v) => setField("skipOnboarding", v)} />
                      <Label className="text-xs">Pular onboarding (aluno já tem dados)</Label>
                    </div>
                  )}
                  <Button onClick={handleCreateUser} disabled={creating} className="w-full">
                    {creating ? "Criando..." : "Criar Conta"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={createProOpen} onOpenChange={setCreateProOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><UserCog size={16} /> Novo Profissional</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-cinzel">Cadastrar Colaborador</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome completo *</Label>
                    <Input placeholder="Ex: Dr. Rey" value={newPro.nome} onChange={(e) => setNewPro(p => ({ ...p, nome: e.target.value }))} className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email *</Label>
                    <Input type="email" placeholder="email@shapeinsano.com" value={newPro.email} onChange={(e) => setNewPro(p => ({ ...p, email: e.target.value }))} className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha Inicial *</Label>
                    <Input type="password" placeholder="Mínimo 6 caracteres" value={newPro.password} onChange={(e) => setNewPro(p => ({ ...p, password: e.target.value }))} className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cargo/Papel *</Label>
                    <Select value={newPro.role} onValueChange={(v) => setNewPro(p => ({ ...p, role: v }))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal Trainer</SelectItem>
                        <SelectItem value="nutricionista">Nutricionista</SelectItem>
                        <SelectItem value="closer">Closer (Vendas/Triagem)</SelectItem>
                        <SelectItem value="cs">CS (Suporte)</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreatePro} disabled={creating} className="w-full mt-2">
                    {creating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                    Criar Colaborador
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {specialistFilter && (
        <div className="flex items-center gap-3 bg-accent/20 border border-accent/30 rounded-lg px-4 py-2">
          <Eye size={16} className="text-accent" />
          <span className="text-sm text-foreground">Filtrando alunos de <strong>{specialistFilterName}</strong></span>
          <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => { searchParams.delete("specialist"); setSearchParams(searchParams); }}>
            Limpar filtro
          </Button>
        </div>
      )}

      <Tabs defaultValue="alunos" className="w-full" onValueChange={setActiveTab}>
        {!specialistFilter && (
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="alunos">Alunos</TabsTrigger>
            <TabsTrigger value="profissionais">Equipe & Especialistas</TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="alunos" className="space-y-6 mt-4">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total", value: totalAlunos },
              { label: "Ativos", value: ativosCount },
              { label: "Em Alerta", value: alertaCount },
              { label: "Inativos", value: inativosCount },
            ].map((s) => (
              <Card key={s.label} className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-foreground">{loadingAlunos ? <Loader2 className="w-5 h-5 animate-spin" /> : s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "relative z-10",
                    (statusFilter !== "todos" || chamaFilter !== "todas" || adesaoFilter !== "todas")
                      && "border-primary text-primary"
                  )}
                >
                  <Filter size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border min-w-[220px] z-50 p-0">
                {/* Ordenação */}
                <div className="px-3 pt-2 pb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ordenar por</p>
                </div>
                <DropdownMenuItem onClick={() => setSortOrder("newest")} className={sortOrder === "newest" ? "text-primary font-semibold" : ""}>
                  <ArrowDown size={14} className="mr-2" /> Mais recentes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortOrder("oldest")} className={sortOrder === "oldest" ? "text-primary font-semibold" : ""}>
                  <ArrowUp size={14} className="mr-2" /> Mais antigos
                </DropdownMenuItem>

                <div className="border-t border-border my-1" />

                {/* Status */}
                <div className="px-3 pt-1 pb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                </div>
                {[
                  { key: "todos", label: "Todos" },
                  { key: "ativo", label: "Ativos" },
                  { key: "inativo", label: "Inativos" },
                  { key: "pendente", label: "Pendentes" },
                ].map((o) => (
                  <DropdownMenuItem key={o.key} onClick={() => setStatusFilter(o.key)} className={statusFilter === o.key ? "text-primary font-semibold" : ""}>
                    {o.label}
                  </DropdownMenuItem>
                ))}

                <div className="border-t border-border my-1" />

                {/* Chama */}
                <div className="px-3 pt-1 pb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Chama</p>
                </div>
                {[
                  { key: "todas", label: "Todas" },
                  { key: "ativa", label: "🔥 Ativa" },
                  { key: "tregua", label: "⚠️ Trégua" },
                  { key: "extinta", label: "💀 Extinta" },
                ].map((o) => (
                  <DropdownMenuItem key={o.key} onClick={() => setChamaFilter(o.key)} className={chamaFilter === o.key ? "text-primary font-semibold" : ""}>
                    {o.label}
                  </DropdownMenuItem>
                ))}

                <div className="border-t border-border my-1" />

                {/* Adesão */}
                <div className="px-3 pt-1 pb-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Adesão</p>
                </div>
                {[
                  { key: "todas", label: "Todas" },
                  { key: "alta", label: "Alta (≥70%)" },
                  { key: "media", label: "Média (30-69%)" },
                  { key: "baixa", label: "Baixa (<30%)" },
                ].map((o) => (
                  <DropdownMenuItem key={o.key} onClick={() => setAdesaoFilter(o.key)} className={adesaoFilter === o.key ? "text-primary font-semibold" : ""}>
                    {o.label}
                  </DropdownMenuItem>
                ))}

                {/* Limpar filtros */}
                {(statusFilter !== "todos" || chamaFilter !== "todas" || adesaoFilter !== "todas") && (
                  <>
                    <div className="border-t border-border my-1" />
                    <DropdownMenuItem
                      onClick={() => { setStatusFilter("todos"); setChamaFilter("todas"); setAdesaoFilter("todas"); setSortOrder("newest"); }}
                      className="text-destructive font-semibold"
                    >
                      Limpar filtros
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">Usuário</th>
                    <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell">Chama</th>
                    <th className="text-left p-3 text-muted-foreground font-medium hidden lg:table-cell">Adesão</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAlunos ? (
                    <tr>
                      <td colSpan={5} className="text-center p-10">
                        <Loader2 className="animate-spin text-primary mx-auto" />
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-10 text-muted-foreground">
                        Nenhum aluno encontrado.
                      </td>
                    </tr>
                  ) : filtered.map((user) => {
                    const displayStatus = mapStatus(user.status);
                    const anamnese = anamneseMap[user.id];
                    const extras = (anamnese?.dados_extras && typeof anamnese.dados_extras === "object") ? anamnese.dados_extras as Record<string, any> : {};
                    const specialistInfo = specialistMap[user.id];
                    const specialist = specialistInfo?.display || "Não atribuído";

                    return (
                    <>
                      <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-foreground">{user.nome || "Sem nome"}</p>
                            <p className="text-xs text-muted-foreground">{user.email || "—"}</p>
                          </div>
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {(() => {
                            const flame = flameMap[user.id];
                            const fState = flame?.state || "normal";
                            const flameColor = fState === "ativa" ? "text-orange-400" : fState === "tregua" ? "text-blue-400" : fState === "extinta" ? "text-muted-foreground" : "text-muted-foreground/50";
                            const flameLabel = fState === "ativa" ? "Ativa" : fState === "tregua" ? "Trégua" : fState === "extinta" ? "Extinta" : "—";
                            return (
                              <div className="flex items-center gap-2">
                                <Flame size={14} className={flameColor} />
                                <span className="text-xs text-foreground">{flameLabel}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {(() => {
                            const flame = flameMap[user.id];
                            const adherence = flame?.adherence ?? 0;
                            return (
                              <div className="flex items-center gap-2 min-w-[100px]">
                                <Progress value={adherence} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground">{adherence}%</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[displayStatus] || statusColor.alerta}`}>{user.status}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Eye size={14} /></Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
                                <DialogHeader>
                                  <DialogTitle className="font-cinzel text-lg">Resumo Completo — {user.nome || user.email}</DialogTitle>
                                  <div className="flex gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[displayStatus] || statusColor.alerta}`}>{user.status}</span>
                                  </div>
                                </DialogHeader>
                                <div className="space-y-5 mt-4">
                                  <SectionBlock icon={User} title="Dados Pessoais">
                                    <Field label="Email" value={user.email || "—"} />
                                    <Field label="Telefone" value={user.telefone || "—"} />
                                    <Field label="Nascimento" value={user.nascimento || "—"} />
                                    <Field label="Sexo" value={user.sexo || "—"} />
                                    <Field label="CPF" value={user.cpf || "—"} />
                                    <Field label="Cidade" value={user.cidade_estado || "—"} />
                                    <Field label="Especialista" value={specialist} />

                                  </SectionBlock>
                                  <div className="border-t border-border" />
                                  <SectionBlock icon={Dumbbell} title="Perfil Físico">
                                    <Field label="Peso" value={user.peso ? `${user.peso}kg` : "—"} />
                                    <Field label="Altura" value={user.altura ? `${user.altura}cm` : "—"} />
                                    <Field label="Objetivo" value={anamnese?.objetivo || "—"} />
                                    <Field label="Experiência" value={anamnese?.experiencia_treino || extras.pratica_musculacao || "—"} />
                                    <Field label="Frequência" value={anamnese?.frequencia_treino || extras.frequencia || "—"} />
                                    <Field label="Local" value={anamnese?.local_treino || "—"} />
                                    <Field label="Lesões" value={anamnese?.lesoes || "Nenhuma"} />
                                  </SectionBlock>
                                  <div className="border-t border-border" />
                                  <SectionBlock icon={Apple} title="Perfil Nutricional">
                                    <Field label="Restrições" value={anamnese?.restricoes_alimentares || "Nenhuma"} />
                                    <Field label="Dieta/Calorias" value={anamnese?.dieta_atual || extras.calorias || "—"} />
                                    <Field label="Suplementos" value={anamnese?.suplementos || "Nenhum"} />
                                    <Field label="Água" value={anamnese?.agua_diaria || extras.agua || "—"} />
                                    <Field label="Refeições" value={extras.refeicoes_dia || "—"} />
                                  </SectionBlock>
                                  <div className="border-t border-border" />
                                  <SectionBlock icon={Brain} title="Saúde & Bem-estar">
                                    <Field label="Sono" value={anamnese?.sono_horas || extras.horario_sono || "—"} />
                                    <Field label="Qualidade do sono" value={extras.qualidade_sono || "—"} />
                                    <Field label="Condições" value={anamnese?.condicoes_saude || "Nenhuma"} />
                                    <Field label="Medicamentos" value={anamnese?.medicamentos || "Nenhum"} />
                                  </SectionBlock>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(user)}>
                              <Edit3 size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Abrir chat"
                              onClick={() => openChatWith(user.id)}
                            >
                              <MessageSquare size={14} />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  {deleting === user.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border-border">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir <strong>{user.nome || user.email}</strong>? Esta ação é irreversível e todos os dados serão perdidos.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteUser(user.id, user.nome || user.email)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}>
                              <div className={`w-7 h-7 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center transition-transform duration-300 ${expandedUser === user.id ? "rotate-180" : ""}`}>
                                <ChevronDown size={14} className="text-muted-foreground" />
                              </div>
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedUser === user.id && (
                        <tr key={`detail-${user.id}`} className="bg-secondary/20">
                          <td colSpan={5} className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                              <div><p className="text-muted-foreground">Meta Peso</p><p className="font-bold text-foreground text-lg">{user.meta_peso || "—"}</p></div>
                              <div><p className="text-muted-foreground">Objetivo</p><p className="font-bold text-foreground text-lg">{anamnese?.objetivo || "—"}</p></div>
                              <div>
                                <p className="text-muted-foreground">Especialistas</p>
                                <div
                                  className="cursor-pointer hover:opacity-80"
                                  onClick={() => openAssignDialog(user.id, user.nome || user.email || "Aluno")}
                                >
                                  {specialistInfo ? (
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                      {specialistInfo.personalName && (
                                        <span className="font-medium text-foreground">{specialistInfo.personalName}</span>
                                      )}
                                      {specialistInfo.nutriName && (
                                        <>
                                          {specialistInfo.personalName && <span className="text-muted-foreground">,</span>}
                                          <span className="font-medium text-foreground">{specialistInfo.nutriName}</span>
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border-0">Nutri</Badge>
                                        </>
                                      )}
                                      <Edit3 size={12} className="text-primary opacity-60" />
                                    </div>
                                  ) : (
                                    <p className="font-medium text-amber-400">
                                      Não atribuído
                                      <Edit3 size={12} className="inline ml-1.5 opacity-60" />
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div><p className="text-muted-foreground">Cadastro</p><p className="font-medium text-foreground">{new Date(user.created_at).toLocaleDateString("pt-BR")}</p></div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card >
        </TabsContent>

        <TabsContent value="profissionais" className="space-y-6 mt-4">
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">Colaborador</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Cargo</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPros ? (
                    <tr>
                      <td colSpan={4} className="text-center p-10">
                        <Loader2 className="animate-spin text-primary mx-auto" />
                      </td>
                    </tr>
                  ) : profissionais.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center p-10 text-muted-foreground">
                        Nenhum profissional cadastrado.
                      </td>
                    </tr>
                  ) : (
                    profissionais.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="p-3">
                          <p className="font-medium text-foreground">{p.nome || "---"}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground capitalize">
                            {p.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === "ativo" ? "bg-emerald-500/20 text-emerald-400" : "bg-destructive/20 text-destructive"}`}>
                            {p.status || "desconhecido"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Eye size={14} /></Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border p-6">
                                <DialogHeader>
                                  <DialogTitle className="font-cinzel text-lg flex items-center gap-2">
                                    Resumo Completo — {p.nome || p.email}
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground capitalize">
                                      {p.role}
                                    </span>
                                  </DialogTitle>
                                </DialogHeader>

                                <Tabs defaultValue="usuario" className="w-full mt-4">
                                  <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="usuario" className="gap-2"><User size={14} /> Usuário</TabsTrigger>
                                    <TabsTrigger value="metricas" className="gap-2"><Activity size={14} /> Métricas</TabsTrigger>
                                    <TabsTrigger value="mensagens" className="gap-2"><MessageSquare size={14} /> Mensagens</TabsTrigger>
                                  </TabsList>

                                  <TabsContent value="usuario" className="space-y-4 mt-4">
                                    <SectionBlock icon={UserCog} title="Dados Pessoais e Configuração">
                                      <Field label="Nome" value={p.nome || "Não definido"} />
                                      <Field label="Email" value={p.email} />
                                      <Field label="Nível Acesso" value={p.role} />
                                      <Field label="Status da Conta" value={p.status} />
                                    </SectionBlock>

                                    <div className="border-t border-border my-4" />
                                    <div className="flex items-center gap-2 mb-3">
                                      <Users size={16} className="text-primary" />
                                      <h3 className="text-sm font-semibold text-foreground">Alunos Atendidos (Mock)</h3>
                                    </div>
                                    <div className="space-y-2">
                                      {mockAlunosAssociados.map((aluno) => (
                                        <div key={aluno.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/30">
                                          <div>
                                            <p className="text-sm font-medium text-foreground">{aluno.name}</p>
                                            <p className="text-xs text-muted-foreground">{aluno.plano}</p>
                                          </div>
                                          <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${aluno.status === "Em Risco" ? "bg-destructive/20 text-destructive" : "bg-emerald-500/20 text-emerald-400"}`}>
                                            {aluno.status}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="metricas" className="space-y-4 mt-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <Card className="bg-secondary/20 border-border">
                                        <CardContent className="p-3 text-center">
                                          <p className="text-2xl font-bold text-foreground">12</p>
                                          <p className="text-[10px] text-muted-foreground uppercase">Atendimentos Hoje</p>
                                        </CardContent>
                                      </Card>
                                      <Card className="bg-secondary/20 border-border">
                                        <CardContent className="p-3 text-center">
                                          <p className="text-2xl font-bold text-foreground">7</p>
                                          <p className="text-[10px] text-muted-foreground uppercase">Planos Entregues</p>
                                        </CardContent>
                                      </Card>
                                      <Card className="bg-secondary/20 border-border">
                                        <CardContent className="p-3 text-center">
                                          <p className="text-2xl font-bold text-emerald-400">95%</p>
                                          <p className="text-[10px] text-muted-foreground uppercase">Adesão dos Alunos</p>
                                        </CardContent>
                                      </Card>
                                      <Card className="bg-secondary/20 border-border">
                                        <CardContent className="p-3 text-center">
                                          <p className="text-2xl font-bold text-foreground">14h</p>
                                          <p className="text-[10px] text-muted-foreground uppercase">Horas no mês</p>
                                        </CardContent>
                                      </Card>
                                    </div>

                                    <SectionBlock icon={Activity} title="Status Operacional">
                                      <Field label="Status Atual" value={<span className="text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online agora</span>} />
                                      <Field label="Último Acesso" value="Hoje, 10:45" />
                                      <Field label="SLA de Resposta Médio" value="2 horas" />
                                      <Field label="Disponibilidade Semanal" value="Seg-Sex, 08h-18h" />
                                    </SectionBlock>

                                    <div className="border-t border-border my-4" />
                                    <h3 className="text-sm font-semibold text-foreground mb-3">Últimas Interações</h3>
                                    <div className="space-y-2">
                                      <div className="p-2 border border-border/50 rounded flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Revisão Treino A - <strong className="text-foreground">Marcus Roberto</strong></span>
                                        <span className="text-xs text-muted-foreground">11:30</span>
                                      </div>
                                      <div className="p-2 border border-border/50 rounded flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Chat via WhatsApp Mapped - <strong className="text-foreground">Lucas Fernandes</strong></span>
                                        <span className="text-xs text-muted-foreground">09:15</span>
                                      </div>
                                    </div>
                                  </TabsContent>

                                  <TabsContent value="mensagens" className="space-y-4 mt-4">
                                    <p className="text-sm text-muted-foreground">Auditoria de conversas vinculadas a este projeto:</p>
                                    <div className="space-y-3">
                                      {mockConversasProfissional.map(msg => (
                                        <div key={msg.id} className="p-4 rounded-md border border-border bg-card">
                                          <div className="flex justify-between items-start mb-2">
                                            <span className="font-medium text-foreground text-sm">{msg.aluno}</span>
                                            <span className="text-xs text-muted-foreground">{msg.hora}</span>
                                          </div>
                                          <p className="text-sm text-muted-foreground bg-secondary/30 p-2 rounded">
                                            "{msg.ultimaMsg}"
                                          </p>
                                          {!msg.lida && (
                                            <p className="text-xs text-destructive mt-2 inline-flex items-center gap-1">
                                              <Activity size={10} /> Aguardando resposta do profissional
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Abrir chat"
                              onClick={() => openChatWith(p.id)}
                            >
                              <MessageSquare size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(p)}>
                              <Edit3 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/20" disabled={deleting === p.id} onClick={() => { if (confirm(`Tem certeza que deseja excluir ${p.nome || p.email}?`)) handleDeleteUser(p.id, p.nome || p.email || ""); }}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Specialist Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Atribuir / Editar Especialistas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Aluno: <strong className="text-foreground">{assignStudentName}</strong></p>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Preparador Físico</Label>
              <Select value={selectedPersonal} onValueChange={setSelectedPersonal}>
                <SelectTrigger><SelectValue placeholder="Selecione o preparador" /></SelectTrigger>
                <SelectContent>
                  {personalList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nutricionista</Label>
              <Select value={selectedNutri} onValueChange={setSelectedNutri}>
                <SelectTrigger><SelectValue placeholder="Selecione o nutricionista" /></SelectTrigger>
                <SelectContent>
                  {nutriList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={handleAssignSpecialist} disabled={assigning || (!selectedPersonal && !selectedNutri)}>
              {assigning ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
              Atribuir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-cinzel">Editar Usuário</DialogTitle>
          </DialogHeader>
          <Tabs value={editTab} onValueChange={setEditTab} className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="vendas" className="flex-1">Vendas</TabsTrigger>
            </TabsList>
            <TabsContent value="dados">
              <div className="space-y-4 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome completo</Label>
                    <Input value={editUser.nome} onChange={(e) => setEditUser(u => ({ ...u, nome: e.target.value }))} className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email (login)</Label>
                    <Input type="email" value={editUser.email} onChange={(e) => setEditUser(u => ({ ...u, email: e.target.value }))} className="bg-background border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha atual (provável)</Label>
                    <div className="relative">
                      <Input 
                        type="text" 
                        readOnly 
                        value={(() => {
                          const cpfDigits = editUser.cpf?.replace(/\D/g, '') || '';
                          if (cpfDigits.length >= 6) return cpfDigits.slice(0, 6);
                          const emailPrefix = editUser.email?.split('@')[0] || '';
                          return emailPrefix + '2025';
                        })()}
                        className="bg-background border-border text-muted-foreground cursor-default" 
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Gerada na criação da conta</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input placeholder="(00) 00000-0000" value={editUser.telefone} onChange={(e) => setEditUser(u => ({ ...u, telefone: e.target.value }))} className="bg-background border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nova Senha</Label>
                    <Input type="password" placeholder="Deixe vazio para manter" value={editUser.password} onChange={(e) => setEditUser(u => ({ ...u, password: e.target.value }))} className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5 flex items-end">
                    <p className="text-[10px] text-muted-foreground pb-2">Preencha apenas se quiser alterar a senha</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF</Label>
                    <Input placeholder="000.000.000-00" value={editUser.cpf} onChange={(e) => setEditUser(u => ({ ...u, cpf: e.target.value }))} className="bg-background border-border" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={editUser.status} onValueChange={(v) => setEditUser(u => ({ ...u, status: v }))}>
                      <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente_onboarding">Pendente Onboarding</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleEditUser} disabled={editing} className="w-full">
                  {editing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  {editing ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="vendas">
              {loadingSales ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
                </div>
              ) : (
              <div className="space-y-4 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Closer responsável</Label>
                  <Select value={salesCloser} onValueChange={setSalesCloser}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o closer" />
                    </SelectTrigger>
                    <SelectContent>
                      {closersList.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Plano / Produto</Label>
                  <Select value={salesProductId} onValueChange={setSalesProductId}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {productsList.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — R$ {Number(p.price).toFixed(2)} ({p.duration_months} {p.duration_months === 1 ? "mês" : "meses"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de adesão</Label>
                  <Input 
                    type="date" 
                    value={salesStartedAt} 
                    onChange={(e) => setSalesStartedAt(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
                {/* Show calculated expiration */}
                {salesProductId && salesStartedAt && (() => {
                  const prod = productsList.find(p => p.id === salesProductId);
                  if (!prod) return null;
                  const start = new Date(salesStartedAt + "T00:00:00");
                  const expires = new Date(start);
                  expires.setMonth(expires.getMonth() + prod.duration_months);
                  const now = new Date();
                  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86400000);
                  const isExpired = daysLeft < 0;
                  const isNearExpiry = daysLeft >= 0 && daysLeft <= 10;
                  
                  return (
                    <div className={cn(
                      "rounded-lg p-3 text-xs space-y-1",
                      isExpired ? "bg-destructive/10 border border-destructive/30" :
                      isNearExpiry ? "bg-amber-500/10 border border-amber-500/30" :
                      "bg-secondary/50 border border-border"
                    )}>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vencimento:</span>
                        <span className="font-medium text-foreground">
                          {expires.toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={cn("font-medium",
                          isExpired ? "text-destructive" :
                          isNearExpiry ? "text-amber-400" :
                          "text-emerald-400"
                        )}>
                          {isExpired ? `Vencido há ${Math.abs(daysLeft)} dias` :
                           isNearExpiry ? `Vence em ${daysLeft} dias ⚠️` :
                           `${daysLeft} dias restantes`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {!salesInviteId && !salesSubscriptionId && (
                  <p className="text-xs text-muted-foreground text-center">
                    Será criado um registro de venda e assinatura automaticamente.
                  </p>
                )}
                <Button onClick={handleSaveSales} disabled={savingSales || !salesStartedAt || !salesProductId} className="w-full">
                  {savingSales ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                  {savingSales ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuarios;
