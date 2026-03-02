import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UserCog, Users, BarChart3, Edit3, Trash2, Eye, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { subscribeGlobalPresence, getOnlineUserIds } from "@/services/presenceService";
import { useAuth } from "@/contexts/AuthContext";
import SpecialistMetricsModal from "@/components/admin/SpecialistMetricsModal";
import EditSpecialistModal from "@/components/admin/EditSpecialistModal";
import DeleteSpecialistDialog from "@/components/admin/DeleteSpecialistDialog";

const MAX_STUDENTS_PER_SPECIALIST = 100;

interface RealSpecialist {
  userId: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

const AdminEspecialistas = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [realSpecialists, setRealSpecialists] = useState<RealSpecialist[]>([]);
  const [loadingReal, setLoadingReal] = useState(true);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});
  const [metricsSpec, setMetricsSpec] = useState<RealSpecialist | null>(null);
  const [editSpec, setEditSpec] = useState<RealSpecialist | null>(null);
  const [deleteSpec, setDeleteSpec] = useState<RealSpecialist | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Load real specialists
  useEffect(() => {
    const load = async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["especialista", "nutricionista", "personal"]);

      if (!roles || roles.length === 0) {
        setLoadingReal(false);
        return;
      }

      const userIds = [...new Set(roles.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", userIds);

      const roleMap: Record<string, string> = {};
      roles.forEach((r) => {
        const label = r.role === "nutricionista" ? "Nutricionista" : r.role === "personal" ? "Preparador Físico" : "Especialista";
        roleMap[r.user_id] = label;
      });

      const specs: RealSpecialist[] = (profiles || []).map((p) => ({
        userId: p.id,
        name: p.nome || "Sem nome",
        role: roleMap[p.id] || "Especialista",
        avatarUrl: p.avatar_url,
      }));

      setRealSpecialists(specs);
      setLoadingReal(false);

      // Load student counts per specialist
      const { data: links } = await supabase
        .from("student_specialists")
        .select("specialist_id, student_id")
        .in("specialist_id", userIds);

      if (links) {
        const counts: Record<string, number> = {};
        links.forEach((l) => {
          counts[l.specialist_id] = (counts[l.specialist_id] || 0) + 1;
        });
        setStudentCounts(counts);
      }

      // Load message counts per specialist (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("sender_id")
        .in("sender_id", userIds)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (msgs) {
        const mc: Record<string, number> = {};
        msgs.forEach((m) => {
          mc[m.sender_id] = (mc[m.sender_id] || 0) + 1;
        });
        setMessageCounts(mc);
      }
    };
    load();
  }, [reloadKey]);

  // Subscribe to global presence for real online status using admin user id
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeGlobalPresence(user.id, (state) => {
      setOnlineIds(getOnlineUserIds(state));
    });
    return unsub;
  }, [user]);

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const handleObserveMessages = (userId: string) => {
    navigate(`/admin/comunicacao?observe=${userId}`);
  };

  const onlineSpecialists = realSpecialists.filter((s) => onlineIds.includes(s.userId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Especialistas</h1>
          <p className="text-sm text-muted-foreground">Gestão de profissionais e métricas</p>
        </div>
        <Button className="crimson-gradient text-foreground">+ Novo Especialista</Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total", value: loadingReal ? "..." : realSpecialists.length, icon: Users },
          { label: "Online", value: loadingReal ? "..." : onlineSpecialists.length, icon: TrendingUp },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <s.icon size={16} className="text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Specialist Cards */}
      {loadingReal ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-primary mr-2" size={20} />
          <p className="text-sm text-muted-foreground">Carregando especialistas...</p>
        </div>
      ) : realSpecialists.length === 0 ? (
        <div className="text-center py-10">
          <UserCog size={32} className="text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">Nenhum especialista cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {realSpecialists.map((spec) => {
            const isOnline = onlineIds.includes(spec.userId);
            const students = studentCounts[spec.userId] || 0;
            const messages = messageCounts[spec.userId] || 0;
            const capacityPercent = Math.min((students / MAX_STUDENTS_PER_SPECIALIST) * 100, 100);

            return (
              <Card key={spec.userId} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {spec.avatarUrl ? (
                        <img src={spec.avatarUrl} alt={spec.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                          {getInitials(spec.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground">{spec.name}</p>
                        <p className="text-xs text-muted-foreground">{spec.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-muted-foreground"}`} />
                      <span className="text-[10px] text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
                      <div className="flex ml-2 border-l border-border pl-2 gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary/50" onClick={() => setEditSpec(spec)}>
                          <Edit3 size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/20" onClick={() => setDeleteSpec(spec)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Carga de alunos</span>
                      <span className="font-medium text-foreground">
                        {students}/{MAX_STUDENTS_PER_SPECIALIST}
                      </span>
                    </div>
                    <Progress
                      value={capacityPercent}
                      className="h-2"
                    />
                  </div>

                  {/* Metrics summary */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-secondary/30 rounded-md px-3 py-2">
                      <p className="text-muted-foreground">Alunos</p>
                      <p className="text-foreground font-bold text-sm">{students}</p>
                    </div>
                    <div className="bg-secondary/30 rounded-md px-3 py-2">
                      <p className="text-muted-foreground">Msgs (30d)</p>
                      <p className="text-foreground font-bold text-sm">{messages}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => navigate(`/admin/usuarios?specialist=${spec.userId}`)}>
                      <Users size={12} /> Usuários
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => setMetricsSpec(spec)}>
                      <BarChart3 size={12} /> Métricas
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => handleObserveMessages(spec.userId)}>
                      <Eye size={12} /> Mensagens
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


      {metricsSpec && (
        <SpecialistMetricsModal
          specialistId={metricsSpec.userId}
          specialistName={metricsSpec.name}
          specialistRole={metricsSpec.role}
          avatarUrl={metricsSpec.avatarUrl}
          isOnline={onlineIds.includes(metricsSpec.userId)}
          open={!!metricsSpec}
          onClose={() => setMetricsSpec(null)}
        />
      )}

      {editSpec && (
        <EditSpecialistModal
          open={!!editSpec}
          onClose={() => setEditSpec(null)}
          specialist={editSpec}
          onUpdated={() => setReloadKey((k) => k + 1)}
        />
      )}

      {deleteSpec && (
        <DeleteSpecialistDialog
          open={!!deleteSpec}
          onClose={() => setDeleteSpec(null)}
          specialist={deleteSpec}
          onDeleted={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default AdminEspecialistas;
