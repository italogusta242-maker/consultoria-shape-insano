import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Shield, Dumbbell, Apple, Headset, TrendingUp, User,
  Info, CheckCircle, XCircle, Loader2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AppRole = "especialista" | "nutricionista" | "personal" | "closer" | "cs";

interface RoleDefinition {
  role: AppRole;
  label: string;
  icon: any;
  color: string;
  description: string;
  permissions: string[];
}

const roleDefinitions: RoleDefinition[] = [
  {
    role: "personal",
    label: "Preparador Físico",
    icon: Dumbbell,
    color: "text-orange-400",
    description:
      "Acesso ao Portal Forja com foco em treinos. Pode visualizar alunos vinculados, criar e editar planos de treino, analisar anamneses, gerenciar exercícios e se comunicar via chat.",
    permissions: [
      "Ver dados e anamneses dos alunos vinculados",
      "Criar/editar planos de treino",
      "Marcar anamneses como analisadas",
      "Criar exercícios na biblioteca",
      "Chat direto com alunos",
      "Gerenciar templates de treino",
    ],
  },
  {
    role: "nutricionista",
    label: "Nutricionista",
    icon: Apple,
    color: "text-green-400",
    description:
      "Acesso ao Portal Forja com foco em dietas. Pode visualizar alunos vinculados, criar e editar planos alimentares, analisar anamneses, gerenciar alimentos e se comunicar via chat.",
    permissions: [
      "Ver dados e anamneses dos alunos vinculados",
      "Criar/editar planos alimentares (dietas)",
      "Marcar anamneses como analisadas",
      "Gerenciar base de alimentos",
      "Chat direto com alunos",
      "Gerenciar templates de dieta",
    ],
  },
  {
    role: "closer",
    label: "Closer (Vendas)",
    icon: TrendingUp,
    color: "text-blue-400",
    description:
      "Acesso ao Portal de Vendas. Pode criar convites para novos alunos, acompanhar status dos convites e registrar leads. Não tem acesso a dados clínicos ou planos.",
    permissions: [
      "Criar convites de acesso para novos alunos",
      "Acompanhar status dos convites enviados",
      "Visualizar perfis básicos dos leads",
      "Registrar valores de planos nos convites",
    ],
  },
  {
    role: "cs",
    label: "CS (Customer Success)",
    icon: Headset,
    color: "text-purple-400",
    description:
      "Acesso ao Portal CS. Monitora engajamento dos alunos, acompanha métricas de retenção, avalia performance dos profissionais e presta suporte direto aos alunos via chat.",
    permissions: [
      "Visualizar todos os alunos e métricas de engajamento",
      "Acompanhar produtividade dos especialistas",
      "Monitorar coortes de retenção",
      "Receber e responder chats de suporte dos alunos",
      "Alertas de inatividade e churn risk",
    ],
  },
];

const RoleCards = () => {
  const [allExpanded, setAllExpanded] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => setAllExpanded(!allExpanded)}
        >
          <ChevronDown
            size={14}
            className={cn("mr-1 transition-transform duration-300", allExpanded && "rotate-180")}
          />
          {allExpanded ? "Recolher todos" : "Expandir todos"}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {roleDefinitions.map((rd) => (
          <Card
            key={rd.role}
            className="bg-card border-border transition-all"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-secondary">
                    <rd.icon size={18} className={rd.color} />
                  </div>
                  <h3 className="font-cinzel text-sm font-bold text-foreground">{rd.label}</h3>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{rd.description}</p>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  allExpanded ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Permissões incluídas:
                  </p>
                  {rd.permissions.map((perm) => (
                    <div key={perm} className="flex items-start gap-1.5">
                      <CheckCircle size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-foreground">{perm}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface Collaborator {
  id: string;
  nome: string | null;
  email: string | null;
  roles: AppRole[];
}

const AdminPermissoes = () => {
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Collaborator | null>(null);
  const queryClient = useQueryClient();

  // Fetch all users who have at least one non-user/admin role, or all profiles for assignment
  const { data: collaborators, isLoading } = useQuery({
    queryKey: ["admin-collaborators"],
    queryFn: async () => {
      const { data: allRoles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesErr) throw rolesErr;

      // Group roles by user
      const roleMap = new Map<string, AppRole[]>();
      for (const r of allRoles ?? []) {
        if (r.role === "user" || r.role === "admin") continue;
        const existing = roleMap.get(r.user_id) ?? [];
        existing.push(r.role as AppRole);
        roleMap.set(r.user_id, existing);
      }

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, nome, email");
      if (profErr) throw profErr;

      const result: Collaborator[] = (profiles ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        roles: roleMap.get(p.id) ?? [],
      }));

      result.sort((a, b) => {
        if (a.roles.length > 0 && b.roles.length === 0) return -1;
        if (a.roles.length === 0 && b.roles.length > 0) return 1;
        return (a.nome ?? "").localeCompare(b.nome ?? "");
      });

      return result;
    },
  });

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, add }: { userId: string; role: AppRole; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: (_, { role, add }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-collaborators"] });
      const rd = roleDefinitions.find((r) => r.role === role);
      const label = rd?.label ?? role;
      toast.success(add ? `Função ${label} atribuída com sucesso` : `Função ${label} removida`);
      if (selectedUser) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                roles: add ? [...prev.roles, role] : prev.roles.filter((r) => r !== role),
              }
            : null
        );
      }
    },
    onError: () => toast.error("Erro ao alterar permissão"),
  });

  const filtered = (collaborators ?? []).filter(
    (c) =>
      (c.nome ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const collaboratorsWithRoles = (collaborators ?? []).filter((c) => c.roles.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Permissões & Funções</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as funções dos colaboradores da plataforma
        </p>
      </div>

      {/* Role descriptions */}
      <RoleCards />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{collaboratorsWithRoles.length}</p>
            <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
          </CardContent>
        </Card>
        {roleDefinitions.map((rd) => (
          <Card key={rd.role} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-foreground">
                {collaboratorsWithRoles.filter((c) => c.roles.includes(rd.role)).length}
              </p>
              <p className="text-xs text-muted-foreground">{rd.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border"
        />
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Colaborador</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Funções Ativas</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((collab) => (
                  <tr
                    key={collab.id}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-foreground">{collab.nome ?? "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{collab.email}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {collab.roles.length > 0 ? (
                          collab.roles.map((role) => {
                            const rd = roleDefinitions.find((r) => r.role === role);
                            return (
                              <Badge
                                key={role}
                                variant="outline"
                                className={cn("text-[10px]", rd?.color)}
                              >
                                {rd?.label ?? role}
                              </Badge>
                            );
                          })
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem função atribuída</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-[hsl(var(--glass-border))]"
                        onClick={() => setSelectedUser(collab)}
                      >
                        <Shield size={12} className="mr-1.5" /> Gerenciar
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">
                      Nenhum colaborador encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Role management dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-cinzel">
              Gerenciar Funções — {selectedUser?.nome ?? selectedUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {roleDefinitions.map((rd) => {
              const hasRole = selectedUser?.roles.includes(rd.role) ?? false;
              const isPending = toggleRoleMutation.isPending;
              return (
                <div
                  key={rd.role}
                  className={cn(
                    "p-4 rounded-lg border transition-all",
                    hasRole
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-secondary/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <rd.icon size={16} className={rd.color} />
                      <span className="font-medium text-sm text-foreground">{rd.label}</span>
                    </div>
                    <Switch
                      checked={hasRole}
                      disabled={isPending}
                      onCheckedChange={(checked) => {
                        if (selectedUser) {
                          toggleRoleMutation.mutate({
                            userId: selectedUser.id,
                            role: rd.role,
                            add: checked,
                          });
                        }
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rd.description}</p>
                  <div className="mt-2 space-y-1">
                    {rd.permissions.slice(0, 3).map((perm) => (
                      <div key={perm} className="flex items-center gap-1.5">
                        <CheckCircle size={10} className="text-emerald-400 shrink-0" />
                        <span className="text-[11px] text-muted-foreground">{perm}</span>
                      </div>
                    ))}
                    {rd.permissions.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{rd.permissions.length - 3} permissões
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Info size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                Alterações de função entram em vigor imediatamente. O colaborador terá acesso ao portal
                correspondente no próximo login.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPermissoes;
