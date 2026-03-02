import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Weight, Ruler, Calendar, Percent, Camera, CreditCard, LogOut, ChevronRight, TrendingDown, Upload, Shield, Clock, MessageCircle, AlertTriangle, Bell, KeyRound } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import PhotoSourcePicker from "@/components/PhotoSourcePicker";
import { useChangePasswordTrigger } from "@/components/ChangePasswordSection";

const Perfil = () => {
  const { signOut, user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nome = profile?.nome ?? "ATLETA";
  

  const [editOpen, setEditOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifPreview, setNotifPreview] = useState<string>("full");
  const { open: pwOpen, setOpen: setPwOpen, ChangePasswordSheet } = useChangePasswordTrigger();

  const weight = profile?.peso ? Number(profile.peso) : 0;
  const height = profile?.altura ? Number(profile.altura) : 0;
  const avatarUrl = profile?.avatar_url ?? null;
  const bodyFat = (profile as any)?.body_fat ? Number((profile as any).body_fat) : null;

  // Fetch plan info from invites - search by auth email, profile email, and CPF
  const { data: inviteData } = useQuery({
    queryKey: ["invite-plan", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Get profile email and CPF
      const { data: prof } = await supabase
        .from("profiles")
        .select("email, cpf")
        .eq("id", user.id)
        .maybeSingle();
      
      const emails = new Set<string>();
      if (user.email) emails.add(user.email);
      if (prof?.email) emails.add(prof.email);
      
      let invite: any = null;
      // Try each email (any status, prioritize most recent)
      for (const email of emails) {
        const { data } = await supabase
          .from("invites")
          .select("plan_value, name, product_id, payment_status, status")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.plan_value) { invite = data; break; }
      }
      // Fallback: search by CPF
      if (!invite && prof?.cpf) {
        const { data } = await supabase
          .from("invites")
          .select("plan_value, name, product_id, payment_status, status")
          .eq("cpf", prof.cpf)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.plan_value) invite = data;
      }
      if (!invite) return null;
      // Fetch product name if product_id exists
      let productName: string | null = null;
      if (invite.product_id) {
        const { data: product } = await supabase
          .from("products")
          .select("name")
          .eq("id", invite.product_id)
          .maybeSingle();
        productName = product?.name || null;
      }
      return { ...invite, productName };
    },
    enabled: !!user,
  });

  // Derive plan name from product or plan_value
  const derivePlanName = () => {
    if (inviteData?.productName) return inviteData.productName;
    if (!inviteData?.plan_value) return "Aluno";
    const val = Number(inviteData.plan_value);
    if (val === 567) return "Trimestral PIX";
    if (val === 597) return "Trimestral Cartão";
    if (val === 297) return "Recorrente Mensal";
    return "Shape Insano Pro";
  };
  const planName = derivePlanName();
  const planLabel = inviteData?.plan_value
    ? `${planName} · R$ ${Number(inviteData.plan_value).toFixed(0)}`
    : planName;

  // Edit form state
  const [editForm, setEditForm] = useState({ weight: 0, height: 0, targetWeight: 0, age: 0 });

  useEffect(() => {
    if (profile) {
      setEditForm({
        weight: profile.peso ? Number(profile.peso) : 0,
        height: profile.altura ? Number(profile.altura) : 0,
        targetWeight: profile.meta_peso ? Number(profile.meta_peso) : 0,
        age: profile.nascimento ? (() => { const a = Math.floor((Date.now() - new Date(profile.nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000)); return a > 0 && a <= 120 ? a : 0; })() : 0,
      });
      setNotifPreview((profile as any).notification_preview || "full");
    }
  }, [profile]);

  const imc = height > 0 ? (weight / ((height / 100) ** 2)).toFixed(1) : "—";
  const weightDiff = editForm.targetWeight > 0 && weight > 0 ? weight - editForm.targetWeight : 0;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        peso: String(editForm.weight),
        altura: String(editForm.height),
        meta_peso: String(editForm.targetWeight),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar medidas");
    } else {
      toast.success("Medidas atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditOpen(false);
    }
  };

  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro ao enviar foto");
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", user.id);

    if (updateError) {
      toast.error("Erro ao atualizar perfil");
    } else {
      toast.success("Avatar atualizado!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
  };


  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "—";

  const handleSaveNotifPreview = async (value: string) => {
    if (!user) return;
    setNotifPreview(value);
    await supabase.from("profiles").update({ notification_preview: value } as any).eq("id", user.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Preferência de notificação atualizada!");
  };

  const menuItems = [
    { icon: Ruler, label: "Atualizar Medidas", sub: "Peso, altura, meta", action: () => setEditOpen(true) },
    { icon: Camera, label: "Minha Evolução", sub: "Fotos de progresso", action: () => navigate("/perfil/evolucao") },
    { icon: Bell, label: "Notificações", sub: "Privacidade das mensagens", action: () => setNotifOpen(true) },
    { icon: CreditCard, label: "Gerenciar Assinatura", sub: `Plano ${planLabel}`, action: () => setSubscriptionOpen(true) },
    { icon: KeyRound, label: "Alterar Senha", sub: "Mude sua senha de acesso", action: () => setPwOpen(true) },
  ];

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4 pb-24">
      <h1 className="font-cinzel text-2xl font-bold text-foreground pt-2">PERFIL</h1>

      {/* Avatar + Identity */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border p-5 flex flex-col items-center relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent" />
        </div>

        <div className="relative mb-3 group">
          <PhotoSourcePicker onFile={handleAvatarFile}>
            <button className="relative cursor-pointer">
              <Avatar className="w-24 h-24 border-4 border-primary/30 shadow-lg shadow-primary/20">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60">
                  <User size={40} className="text-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload size={20} className="text-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-card">
                <Camera size={12} className="text-primary-foreground" />
              </div>
            </button>
          </PhotoSourcePicker>
        </div>

        <h2 className="font-cinzel text-xl font-bold text-foreground">{nome.toUpperCase()}</h2>
        <div className="flex items-center gap-2 mt-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold">
            {planLabel}
          </Badge>
          <span className="text-[11px] text-muted-foreground">No foco desde {memberSince}</span>
        </div>
      </motion.div>

      {/* Biometrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            icon: Weight,
            label: "Peso",
            value: weight > 0 ? `${weight}kg` : "—",
            sub: editForm.targetWeight > 0 && weight > 0 ? (
              <span className="flex items-center gap-1">
                <TrendingDown size={10} className="text-accent" />
                <span>Meta: {editForm.targetWeight}kg ({weightDiff > 0 ? `-${weightDiff}` : `+${Math.abs(weightDiff)}`}kg)</span>
              </span>
            ) : "Defina nas medidas",
            color: "text-primary",
          },
          { icon: Ruler, label: "Altura", value: height > 0 ? `${(height / 100).toFixed(2)}m` : "—", sub: height > 0 ? `${height} cm` : "Defina nas medidas", color: "text-accent" },
          { icon: Calendar, label: "Idade", value: editForm.age > 0 ? `${editForm.age}` : "—", sub: "anos", color: "text-primary" },
          { icon: Percent, label: "IMC / BF%", value: bodyFat != null ? imc : "—", sub: bodyFat != null ? `BF: ${bodyFat}%` : "Aguardando avaliação", color: "text-accent" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <stat.icon size={20} className={`${stat.color} mb-2`} />
            <p className="font-cinzel text-lg font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Action Menu */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border"
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <item.icon size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-[11px] text-muted-foreground">{item.sub}</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/40 shrink-0" />
          </button>
        ))}
      </motion.div>

      <ChangePasswordSheet />

      {/* Sign out */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={signOut}
        className="w-full bg-card rounded-xl border border-border p-4 flex items-center gap-3 hover:border-primary/30 transition-colors"
      >
        <LogOut size={20} className="text-muted-foreground" />
        <span className="text-sm text-foreground">Sair da conta</span>
      </motion.button>

      {/* Edit Biometrics Sheet */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-foreground">Atualizar Medidas</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">Peso (kg)</Label>
                <Input type="number" className="bg-secondary border-border mt-1" value={editForm.weight || ""}
                  onChange={(e) => setEditForm({ ...editForm, weight: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Meta (kg)</Label>
                <Input type="number" className="bg-secondary border-border mt-1" value={editForm.targetWeight || ""}
                  onChange={(e) => setEditForm({ ...editForm, targetWeight: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Altura (cm)</Label>
                <Input type="number" className="bg-secondary border-border mt-1" value={editForm.height || ""}
                  onChange={(e) => setEditForm({ ...editForm, height: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Idade</Label>
                <Input type="number" className="bg-secondary border-border mt-1 opacity-60" value={editForm.age || ""} disabled />
              </div>
            </div>
            {/* BF% read-only from specialist */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <Label className="text-muted-foreground text-xs">BF% (Gordura Corporal)</Label>
              <p className="text-sm text-foreground mt-1 font-medium">
                {bodyFat != null ? `${bodyFat}%` : "Aguardando avaliação da equipe"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Este dado é inserido após avaliação do seu Nutricionista ou Personal.</p>
            </div>
            <Button onClick={handleSave} className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Subscription Management Sheet */}
      <Sheet open={subscriptionOpen} onOpenChange={setSubscriptionOpen}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-foreground">Gerenciar Assinatura</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 py-4">
            {/* Plan card */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield size={20} className="text-primary" />
                  <span className="font-cinzel font-bold text-foreground">{planLabel}</span>
                </div>
                <Badge className="bg-accent/20 text-accent border-accent/30 text-[10px]">Ativo</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Para detalhes da sua assinatura ou alteração de plano, entre em contato com nosso suporte.
              </p>
            </div>

            {/* Cancel button */}
            <button
              onClick={() => setCancelConfirmOpen(true)}
              className="w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground py-2 transition-colors"
            >
              Cancelar assinatura
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation Sheet */}
      <Sheet open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-foreground">Cancelar Assinatura</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Sentiremos sua falta!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Para cancelar, fale com nosso suporte. Queremos entender o que podemos melhorar e encontrar a melhor solução para você.
                </p>
              </div>
            </div>

            <a
              href="https://api.whatsapp.com/send?phone=5561999281490&text=Quero%20cancelar%20a%20minha%20assinatura%20do%20APP%20Shape%20Insano"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setCancelConfirmOpen(false);
                setSubscriptionOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium no-underline hover:bg-primary/90 transition-colors"
            >
              <MessageCircle size={16} />
              Falar com Suporte via WhatsApp
            </a>

            <button
              onClick={() => setCancelConfirmOpen(false)}
              className="w-full text-center text-xs text-muted-foreground py-2"
            >
              Voltar
            </button>
          </div>
        </SheetContent>
      </Sheet>
      {/* Notification Privacy Sheet */}
      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-cinzel text-foreground">Privacidade das Notificações</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Controle o que aparece nas notificações de mensagens:
            </p>
            <Select value={notifPreview} onValueChange={handleSaveNotifPreview}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Mostrar remetente + mensagem completa</SelectItem>
                <SelectItem value="partial">Mostrar remetente + trecho (40 caracteres)</SelectItem>
                <SelectItem value="none">Apenas "Nova mensagem" (mais privado)</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Exemplo de notificação:</p>
              <div className="bg-background rounded-lg p-3 border border-border">
                <p className="text-sm font-semibold text-foreground">
                  {notifPreview === "none" ? "Shape Insano" : "Nutricionista João"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {notifPreview === "full" && "Oi, já revisei sua dieta de hoje e fiz alguns ajustes..."}
                  {notifPreview === "partial" && "Oi, já revisei sua dieta de hoje e…"}
                  {notifPreview === "none" && "Você recebeu uma nova mensagem"}
                </p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Perfil;
