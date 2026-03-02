import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { calcAge } from "@/lib/calcAge";

const statusLabels: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-emerald-500/20 text-emerald-400" },
  pendente_onboarding: { label: "Pend. Onboarding", className: "bg-amber-500/20 text-amber-400" },
  pendente_autorizacao: { label: "Pend. Autorização", className: "bg-blue-500/20 text-blue-400" },
  inativo: { label: "Inativo", className: "bg-destructive/20 text-destructive" },
};

type SortKey = "nome" | "status" | "online" | "lastAccess" | "inactivity";
type SortDir = "asc" | "desc";

const CSAlunos = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [onlineFilter, setOnlineFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastAccess");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: students, isLoading } = useQuery({
    queryKey: ["cs-students-tracking"],
    queryFn: async () => {
      // 1. Puxa todos os perfis e cargos para isolar apenas ALUNOS reais.
      const { data: profilesData } = await supabase.from("profiles").select("id, nome, email, status, created_at, nascimento, telefone");
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");

      const roles = rolesData || [];
      const profiles = profilesData || [];

      const nonStudentRoles = ["especialista", "admin", "closer", "cs", "nutricionista", "personal"];
      const nonStudentIds = new Set(roles.filter(r => nonStudentRoles.includes(r.role)).map(r => r.user_id));

      const alunos = profiles.filter(p => !nonStudentIds.has(p.id));

      return alunos.map((p) => {
        // Cálculo de horas desde o último login/acesso
        const lastAccessDate = (p as any).ultimo_acesso ? new Date((p as any).ultimo_acesso) : new Date(p.created_at);
        const hoursOffline = Math.floor((new Date().getTime() - lastAccessDate.getTime()) / (1000 * 60 * 60));

        // Determina se está Online (Logou/Navegou há menos de 2h = Online)
        const isOnline = hoursOffline < 2;

        return {
          ...p,
          age: calcAge(p.nascimento),
          lastAccessDate,
          hoursOffline,
          isOnline
        };
      });
    },
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="ml-1 text-primary" />
      : <ArrowDown size={12} className="ml-1 text-primary" />;
  };

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.toLowerCase();
    let list = students.filter(
      (s) => !q || s.nome?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
    if (statusFilter !== "all") {
      list = list.filter(s => s.status === statusFilter);
    }
    if (onlineFilter === "online") {
      list = list.filter(s => s.isOnline);
    } else if (onlineFilter === "offline") {
      list = list.filter(s => !s.isOnline);
    }

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "nome":
          cmp = (a.nome || "").localeCompare(b.nome || "");
          break;
        case "status":
          cmp = (a.status || "").localeCompare(b.status || "");
          break;
        case "online":
          cmp = (a.isOnline === b.isOnline ? 0 : a.isOnline ? -1 : 1);
          break;
        case "lastAccess":
          cmp = a.lastAccessDate.getTime() - b.lastAccessDate.getTime();
          break;
        case "inactivity":
          cmp = a.hoursOffline - b.hoursOffline;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [students, search, statusFilter, onlineFilter, sortKey, sortDir]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Alunos</h1>
        <p className="text-sm text-muted-foreground">Listagem e rastreamento de acessos da base</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-background border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente_onboarding">Pend. Onboarding</SelectItem>
            <SelectItem value="pendente_autorizacao">Pend. Autorização</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={onlineFilter} onValueChange={setOnlineFilter}>
          <SelectTrigger className="w-[160px] bg-background border-border">
            <SelectValue placeholder="Online/Offline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left p-3 text-muted-foreground font-medium cursor-pointer select-none" onClick={() => toggleSort("nome")}>
                    <span className="inline-flex items-center">Aluno <SortIcon col="nome" /></span>
                  </th>
                  <th className="text-center p-3 text-muted-foreground font-medium cursor-pointer select-none" onClick={() => toggleSort("status")}>
                    <span className="inline-flex items-center justify-center">Status <SortIcon col="status" /></span>
                  </th>
                  <th className="text-center p-3 text-muted-foreground font-medium cursor-pointer select-none" onClick={() => toggleSort("online")}>
                    <span className="inline-flex items-center justify-center">Online/Offline <SortIcon col="online" /></span>
                  </th>
                  <th className="text-center p-3 text-muted-foreground font-medium hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("lastAccess")}>
                    <span className="inline-flex items-center justify-center">Último Acesso <SortIcon col="lastAccess" /></span>
                  </th>
                  <th className="text-right p-3 text-muted-foreground font-medium hidden md:table-cell cursor-pointer select-none" onClick={() => toggleSort("inactivity")}>
                    <span className="inline-flex items-center justify-end">Inatividade <SortIcon col="inactivity" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const cfg = statusLabels[s.status] ?? statusLabels.ativo;

                  // Formatando o tempo de inatividade para exibição legível
                  let inatividadeTag = `${s.hoursOffline} hrs`;
                  if (s.hoursOffline > 48) {
                    inatividadeTag = `${Math.floor(s.hoursOffline / 24)} dias`;
                  }
                  if (s.hoursOffline < 1) {
                    inatividadeTag = "Agora";
                  }

                  return (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{s.nome || "—"}</span>
                          <span className="text-xs text-muted-foreground">{s.email}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Idade: {s.age !== null ? `${s.age}a` : "—"}</span>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {s.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></span>
                            Offline
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center hidden md:table-cell text-muted-foreground text-xs">
                        {s.lastAccessDate.toLocaleDateString("pt-BR")} às {s.lastAccessDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      <td className="p-3 text-right hidden md:table-cell">
                        <span className={`text-xs font-medium ${s.hoursOffline > 48 ? 'text-amber-400' : 'text-foreground'}`}>
                          {s.isOnline ? "—" : inatividadeTag}
                        </span>
                        {s.hoursOffline > 48 && s.status !== 'inativo' && (
                          <p className="text-[10px] text-amber-500/70 mt-0.5">Risco de Churn</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CSAlunos;
