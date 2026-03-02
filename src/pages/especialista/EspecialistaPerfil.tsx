import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { User, Star, Shield, Award, TrendingUp, LogOut, Loader2, KeyRound } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMySpecialty } from "@/hooks/useSpecialistStudents";
import { useState } from "react";
import { toast } from "sonner";
import { useChangePasswordTrigger } from "@/components/ChangePasswordSection";

const EspecialistaPerfil = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: rawSpecialty } = useMySpecialty();
  const [saving, setSaving] = useState(false);
  const { open: pwOpen, setOpen: setPwOpen, ChangePasswordSheet } = useChangePasswordTrigger();

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["specialist-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome, email, telefone, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch real stats
  const { data: stats } = useQuery({
    queryKey: ["specialist-stats", user?.id],
    queryFn: async () => {
      const [studentsRes, trainingRes, dietRes] = await Promise.all([
        supabase.from("student_specialists").select("id", { count: "exact", head: true }).eq("specialist_id", user!.id),
        supabase.from("training_plans").select("id", { count: "exact", head: true }).eq("specialist_id", user!.id),
        supabase.from("diet_plans").select("id", { count: "exact", head: true }).eq("specialist_id", user!.id),
      ]);
      return {
        students: studentsRes.count ?? 0,
        plans: (trainingRes.count ?? 0) + (dietRes.count ?? 0),
      };
    },
    enabled: !!user,
  });

  const [formName, setFormName] = useState<string | null>(null);
  const [formPhone, setFormPhone] = useState<string | null>(null);

  const displayName = formName ?? profile?.nome ?? "";
  const displayPhone = formPhone ?? profile?.telefone ?? "";
  const specialtyLabel = rawSpecialty?.toLowerCase().includes("nutri") ? "Nutricionista" : rawSpecialty?.toLowerCase().includes("preparador") || rawSpecialty?.toLowerCase().includes("fisico") ? "Preparador Físico" : rawSpecialty ?? "Especialista";

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: displayName, telefone: displayPhone })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar alterações");
    } else {
      toast.success("Perfil atualizado!");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground">Seus dados como especialista da plataforma</p>
      </div>

      <div className="relative rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] backdrop-blur-md overflow-hidden">
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-15 bg-[hsl(var(--gold))] pointer-events-none" />
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <AvatarUpload
              userId={user!.id}
              avatarUrl={profile?.avatar_url}
              size="md"
              invalidateKeys={[["specialist-profile", user!.id]]}
            />
            <div>
              <h2 className="text-lg font-bold text-foreground">{profile?.nome ?? "Especialista"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-[10px] bg-accent/10 text-accent border-accent/20 gap-1">
                  <Award size={10} /> {specialtyLabel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="text-center p-3 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
              <p className="text-2xl font-bold text-foreground">{stats?.students ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Alunos ativos</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))]">
              <p className="text-2xl font-bold text-foreground">{stats?.plans ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Planos criados</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome</Label>
                <Input
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] backdrop-blur-md mt-1"
                  value={displayName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] backdrop-blur-md mt-1"
                  value={profile?.email ?? ""}
                  disabled
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Especialidade</Label>
                <Input
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] backdrop-blur-md mt-1"
                  value={specialtyLabel}
                  disabled
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Telefone</Label>
                <Input
                  className="bg-[hsl(var(--glass-bg))] border-[hsl(var(--glass-border))] backdrop-blur-md mt-1"
                  value={displayPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
            </div>
            <Button
              className="w-full mt-4 gold-gradient text-accent-foreground font-medium"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
            <Button
              variant="outline"
              className="w-full border-border text-foreground hover:bg-secondary/50"
              onClick={() => setPwOpen(true)}
            >
              <KeyRound size={16} className="mr-2" />
              Alterar Senha
            </Button>
          </div>
        </div>
      </div>

      <ChangePasswordSheet />

      <Button
        variant="outline"
        className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
        onClick={handleSignOut}
      >
        <LogOut size={16} className="mr-2" />
        Sair da Conta
      </Button>
    </div>
  );
};

export default EspecialistaPerfil;
