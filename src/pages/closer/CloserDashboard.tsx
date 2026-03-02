import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Send, Users, DollarSign, Clock, CheckCircle2, XCircle,
  Loader2, Copy, Plus, Mail, Eye, UserPlus, ExternalLink, Ban
} from "lucide-react";
import { KpiDetailModal } from "@/components/ui/kpi-detail-modal";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Invite {
  id: string;
  token: string;
  email: string;
  name: string | null;
  cpf: string | null;
  plan_value: number | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  product_id: string | null;
  payment_status: string | null;
  product_name?: string;
  invoice_url?: string | null;
  subscription_plan_id?: string | null;
  email_opened_at?: string | null;
  payment_link_clicked_at?: string | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
  billing_type: string;
  payment_method: string;
  max_installments: number;
  description: string | null;
  active: boolean;
}

interface ChargeResult {
  payment: any;
  pix?: { encodedImage: string; payload: string };
  invoice_url?: string;
  plan_name?: string;
  billing_type?: string;
  invite_id?: string;
}

type CloserModalKey = "total" | "convertidos" | "pendentes" | "valor" | null;

const CloserDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [successData, setSuccessData] = useState<{ email: string; password: string; url: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", cpf: "" });
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [activeModal, setActiveModal] = useState<CloserModalKey>(null);
  const [credentialInvite, setCredentialInvite] = useState<Invite | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState<string | null>(null);
  const [cancelingInvite, setCancelingInvite] = useState<string | null>(null);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);

  // Fetch subscription plans from DB
  const { data: plans } = useQuery({
    queryKey: ["closer-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("price");
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
    enabled: !!user,
  });

  const selectedPlan = plans?.find((p) => p.id === selectedPlanId);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const { data: invites, isLoading } = useQuery({
    queryKey: ["closer-invites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*, products:product_id(name)")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const emails = (data ?? []).map((inv: any) => inv.email);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("email, status")
        .in("email", emails);

      const now = new Date();
      return (data ?? []).map((inv: any): Invite => ({
        ...inv,
        product_name: inv.products?.name || null,
        status: inv.status === "pending" && inv.expires_at && new Date(inv.expires_at) < now
          ? "expired"
          : inv.status,
      }));
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Realtime subscription for invites
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('closer-invites-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invites',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["closer-invites"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const { data: profileStatuses } = useQuery({
    queryKey: ["closer-profile-statuses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("email, status");
      if (error) throw error;
      return data as { email: string; status: string }[];
    },
    enabled: !!user,
  });

  const profileStatusMap = new Map<string, string>();
  profileStatuses?.forEach((p) => {
    if (p.email) profileStatusMap.set(p.email.toLowerCase(), p.status);
  });

  const buildPaymentEmailHtml = (name: string, paymentLink: string, planDescription: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:30px;">
      <h1 style="color:#d4af37;font-size:28px;margin:0;">🔥 Shape Insano PRO</h1>
      <p style="color:#888;font-size:14px;margin-top:8px;">Sua jornada de transformação começa aqui</p>
    </div>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:30px;">
      <p style="color:#fff;font-size:16px;margin-top:0;">Olá${name ? ` <strong>${name}</strong>` : ""},</p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;">
        Estamos muito felizes em ter você! Para ativar sua conta no <strong style="color:#d4af37;">Shape Insano PRO</strong>, 
        finalize o pagamento clicando no botão abaixo.
      </p>
      <div style="background:#111;border:1px solid #333;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
        <p style="color:#888;font-size:12px;margin:0 0 8px 0;">PLANO SELECIONADO</p>
        <p style="color:#d4af37;font-size:18px;font-weight:bold;margin:0;">${planDescription}</p>
      </div>
      <a href="${paymentLink}" style="display:block;text-align:center;background:#d4af37;color:#000;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin-top:20px;">
        Finalizar Pagamento →
      </a>
      <p style="color:#666;font-size:12px;text-align:center;margin-top:16px;">
        Após a confirmação do pagamento, você receberá automaticamente suas credenciais de acesso por e-mail.
      </p>
    </div>
    <p style="color:#666;font-size:11px;text-align:center;margin-top:20px;">
      Este e-mail foi enviado automaticamente pelo Shape Insano PRO.
    </p>
  </div>
</body>
</html>`;

  const buildCredentialEmailHtml = (name: string, email: string, password: string, url: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:30px;">
      <h1 style="color:#d4af37;font-size:28px;margin:0;">🔥 Shape Insano PRO</h1>
      <p style="color:#888;font-size:14px;margin-top:8px;">Bem-vindo à sua jornada de transformação</p>
    </div>
    <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:30px;">
      <p style="color:#fff;font-size:16px;margin-top:0;">Olá${name ? ` <strong>${name}</strong>` : ""},</p>
      <p style="color:#ccc;font-size:14px;line-height:1.6;">
        Sua conta no <strong style="color:#d4af37;">Shape Insano PRO</strong> foi criada com sucesso!
        Use as credenciais abaixo para fazer seu primeiro acesso.
      </p>
      <div style="background:#111;border:1px solid #333;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="color:#888;font-size:12px;margin:0 0 8px 0;">URL DE ACESSO</p>
        <a href="${url}" style="color:#d4af37;font-size:16px;text-decoration:none;word-break:break-all;">${url}</a>
        <hr style="border:none;border-top:1px solid #333;margin:16px 0;">
        <p style="color:#888;font-size:12px;margin:0 0 8px 0;">LOGIN (E-MAIL)</p>
        <p style="color:#fff;font-size:16px;margin:0 0 16px 0;">${email}</p>
        <p style="color:#888;font-size:12px;margin:0 0 8px 0;">SENHA (CPF)</p>
        <p style="color:#fff;font-size:16px;margin:0;">${password}</p>
      </div>
      <a href="${url}" style="display:block;text-align:center;background:#d4af37;color:#000;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin-top:20px;">
        Acessar Agora →
      </a>
    </div>
    <p style="color:#666;font-size:11px;text-align:center;margin-top:20px;">
      Este e-mail foi enviado automaticamente pelo Shape Insano PRO.
    </p>
  </div>
</body>
</html>`;

  const sendPaymentEmail = async (toEmail: string, toName: string, paymentLink: string, planDescription: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          toEmail,
          toName,
          subject: "🔥 Finalize seu pagamento — Shape Insano PRO",
          htmlContent: buildPaymentEmailHtml(toName, paymentLink, planDescription),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (e: any) {
      console.error("Erro ao enviar e-mail de pagamento:", e);
      return false;
    }
  };

  const sendCredentialsEmail = async (toEmail: string, toName: string, password: string) => {
    const accessUrl = window.location.origin;
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          toEmail,
          toName,
          subject: "🔥 Suas credenciais de acesso — Shape Insano PRO",
          htmlContent: buildCredentialEmailHtml(toName, toEmail, password, accessUrl),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return true;
    } catch (e: any) {
      console.error("Erro ao enviar e-mail:", e);
      return false;
    }
  };

  // Step 1: Create charge via API + invite
  const handleSendPaymentLink = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim() || !emailRegex.test(form.email.trim())) {
      toast.error("E-mail inválido. Verifique se digitou corretamente (ex: nome@email.com)");
      return;
    }
    if (!form.cpf.trim() || form.cpf.replace(/\D/g, "").length < 11) {
      toast.error("CPF é obrigatório e deve ter 11 dígitos");
      return;
    }
    if (!selectedPlanId || !selectedPlan) {
      toast.error("Selecione um plano");
      return;
    }

    setSendingInvite(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-payments", {
        body: {
          action: "closer_create_charge",
          name: form.name.trim() || form.email.split("@")[0],
          email: form.email.trim().toLowerCase(),
          cpf: form.cpf.trim(),
          plan_id: selectedPlanId,
          idempotency_key: `closer_${user!.id}_${form.email.trim()}_${Date.now()}`,
        },
      });

      if (error) throw new Error(error.message || "Erro ao gerar cobrança");
      if (data?.error) throw new Error(data.error);

      setChargeResult(data as ChargeResult);
      toast.success("Cobrança gerada e e-mail enviado!");

      queryClient.invalidateQueries({ queryKey: ["closer-invites"] });
      setCreateOpen(false);
      setForm({ name: "", email: "", cpf: "" });
    } catch (e: any) {
      toast.error("Erro ao gerar cobrança: " + (e.message || ""));
    } finally {
      setSendingInvite(false);
    }
  };

  // Step 2: Create account after payment confirmed
  const handleCreateAccount = async (invite: Invite) => {
    setCreatingAccount(invite.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-invite", {
        body: {
          name: invite.name,
          email: invite.email,
          cpf: invite.cpf,
          plan_value: invite.plan_value,
          product_id: invite.product_id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const cpfClean = (invite.cpf || "").replace(/\D/g, "");
      setSuccessData({
        email: invite.email.toLowerCase(),
        password: cpfClean,
        url: window.location.origin,
      });

      // Send credentials email
      const emailSent = await sendCredentialsEmail(
        invite.email.toLowerCase(),
        invite.name || "",
        cpfClean,
      );
      if (emailSent) {
        toast.success("Conta criada e credenciais enviadas por e-mail!");
      } else {
        toast.warning("Conta criada, mas erro ao enviar e-mail. Use o reenvio manual.");
      }

      queryClient.invalidateQueries({ queryKey: ["closer-invites"] });
      queryClient.invalidateQueries({ queryKey: ["closer-profile-statuses"] });
    } catch (e: any) {
      toast.error("Erro ao criar conta: " + (e.message || ""));
    } finally {
      setCreatingAccount(null);
    }
  };

  const handleResetModal = (open: boolean) => {
    if (!open) {
      setForm({ name: "", email: "", cpf: "" });
      setSelectedPlanId("");
    }
    setCreateOpen(open);
  };

  const safeCopy = async (text: string, successMsg = "Copiado!") => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(successMsg);
    } catch {
      toast.error("Falha ao copiar. Selecione o texto manualmente.");
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/convite/${token}`;
    safeCopy(link, "Link copiado!");
  };

  // KPIs
  const total = invites?.length ?? 0;
  const used = invites?.filter((i) => i.status === "used").length ?? 0;
  const pending = invites?.filter((i) => i.status === "pending").length ?? 0;
  const totalValue = invites
    ?.filter((i) => i.status === "used" && i.plan_value)
    .reduce((sum, i) => sum + (i.plan_value ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Painel do Closer</h1>
          <p className="text-sm text-muted-foreground">Gestão Comercial, Vínculos e Retenção</p>
        </div>
      </div>

      <div className="space-y-6 mt-4">

        <div className="space-y-6">
          <div className="flex items-center justify-end">
            <Dialog open={createOpen} onOpenChange={handleResetModal}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus size={16} /> Novo Convite
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-cinzel">Gerar Convite de Acesso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do cliente</Label>
                    <Input
                      placeholder="Ex: Marcus Vinícius"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail *</Label>
                    <Input
                      type="email"
                      placeholder="cliente@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF *</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={form.cpf}
                      onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                      className="bg-background border-border"
                    />
                  </div>

                  {/* Plan Selector */}
                  <div className="space-y-3">
                    <Label className="text-xs">Plano *</Label>
                    <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue placeholder="Selecione um plano..." />
                      </SelectTrigger>
                      <SelectContent>
                        {plans?.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            <span className="flex items-center justify-between gap-4 w-full">
                              <span>{plan.name}</span>
                              <span className="font-bold">{formatCurrency(plan.price)}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedPlan && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{selectedPlan.name}</span>
                          <span className="text-sm font-bold text-primary">{formatCurrency(selectedPlan.price)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedPlan.billing_type === "recurring" ? "🔄 Recorrente mensal" : 
                            `${selectedPlan.payment_method === "PIX" ? "💰 PIX" : "💳 Cartão"}${selectedPlan.max_installments > 1 ? ` até ${selectedPlan.max_installments}x` : " à vista"}`
                          }
                          {" · "}{selectedPlan.duration_months === 1 ? "mensal" : `${selectedPlan.duration_months} meses`}
                        </p>
                        {selectedPlan.description && (
                          <p className="text-xs text-muted-foreground">{selectedPlan.description}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground">
                      📩 A cobrança será gerada automaticamente e o cliente receberá por e-mail os dados de pagamento
                      {selectedPlan?.payment_method === "PIX" ? " (QR Code PIX)" : selectedPlan?.billing_type === "recurring" ? " (link de assinatura)" : " (link de pagamento)"}.
                    </p>
                  </div>

                  <Button
                    onClick={handleSendPaymentLink}
                    disabled={sendingInvite}
                    className="w-full gap-2 transition-all mt-4"
                  >
                    {sendingInvite ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                    ) : (
                      <><Send size={16} /> Enviar Link de Pagamento</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Charge Result Dialog */}
          <Dialog open={!!chargeResult} onOpenChange={(open) => !open && setChargeResult(null)}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="font-cinzel flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Cobrança Gerada!
                </DialogTitle>
              </DialogHeader>
              {chargeResult && (
                <div className="space-y-4 mt-2">
                  <div className="p-3 rounded-lg bg-secondary/50 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plano:</span>
                      <span className="font-medium text-foreground">{chargeResult.plan_name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Método:</span>
                      <span className="font-medium text-foreground">{chargeResult.billing_type === "PIX" ? "PIX" : "Cartão"}</span>
                    </div>
                  </div>

                  {chargeResult.pix && (
                    <div className="space-y-3">
                      <div className="flex justify-center">
                        <img src={`data:image/png;base64,${chargeResult.pix.encodedImage}`} alt="QR Code PIX" className="w-48 h-48 rounded-lg" />
                      </div>
                      <div className="p-2 bg-secondary/30 rounded text-xs text-muted-foreground break-all text-center">
                        {chargeResult.pix.payload}
                      </div>
                      <Button className="w-full gap-2" onClick={() => {
                        navigator.clipboard.writeText(chargeResult.pix!.payload);
                        toast.success("Código PIX copiado!");
                      }}>
                        <Copy size={14} /> Copiar PIX
                      </Button>
                    </div>
                  )}

                  {chargeResult.invoice_url && (
                    <Button className="w-full gap-2" variant="outline" asChild>
                      <a href={chargeResult.invoice_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} /> Abrir Link de Pagamento
                      </a>
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    O cliente já recebeu os dados de pagamento por e-mail.
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Success Dialog */}
          <Dialog open={!!successData} onOpenChange={(open) => !open && setSuccessData(null)}>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="font-cinzel flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Conta Criada com Sucesso!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  As credenciais foram enviadas por e-mail. Você também pode copiar abaixo:
                </p>
                <div className="space-y-3 bg-secondary/50 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">URL de Acesso</p>
                    <p className="text-sm font-medium text-foreground break-all">{successData?.url}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Login (E-mail)</p>
                    <p className="text-sm font-medium text-foreground">{successData?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Senha (CPF)</p>
                    <p className="text-sm font-medium text-foreground">{successData?.password}</p>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    const text = `🔥 Shape Insano PRO\n\nAcesse: ${successData?.url}\nLogin: ${successData?.email}\nSenha: ${successData?.password}\n\nFaça seu primeiro acesso e comece o onboarding!`;
                    safeCopy(text, "Dados copiados para a área de transferência!");
                  }}
                >
                  <Copy size={16} /> Copiar dados de acesso
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]" onClick={() => setActiveModal("total")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><Send size={16} className="text-muted-foreground" /></div>
                <p className="text-2xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">Convites gerados</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]" onClick={() => setActiveModal("convertidos")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><Users size={16} className="text-emerald-400" /></div>
                <p className="text-2xl font-bold text-foreground">{used}</p>
                <p className="text-xs text-muted-foreground">Convertidos</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]" onClick={() => setActiveModal("pendentes")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-amber-400" /></div>
                <p className="text-2xl font-bold text-foreground">{pending}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border cursor-pointer hover:border-primary/30 hover:bg-secondary/20 transition-all duration-200 active:scale-[0.98]" onClick={() => setActiveModal("valor")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1"><DollarSign size={16} className="text-gold" /></div>
                <p className="text-2xl font-bold text-foreground">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground">Valor convertido</p>
              </CardContent>
            </Card>
          </div>

          {/* Invites List */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Convites Gerados</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !invites || invites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum convite gerado ainda. Clique em "Novo Convite" para começar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-muted-foreground font-medium">Cliente</th>
                        <th className="text-left p-3 text-muted-foreground font-medium hidden md:table-cell">Valor</th>
                        <th className="text-left p-3 text-muted-foreground font-medium">Funil</th>
                        <th className="text-left p-3 text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invites.filter(inv => inv.status !== "expired").map((invite) => {
                        const profileStatus = profileStatusMap.get(invite.email.toLowerCase());
                        const isAtivo = profileStatus && profileStatus !== "pendente_onboarding";
                        const paymentConfirmed = invite.payment_status === "paid";
                        const accountCreated = invite.status === "used";
                        const canCreateAccount = paymentConfirmed && !accountCreated;

                        // Funnel badge logic
                        const getFunnelBadge = () => {
                          if (paymentConfirmed || accountCreated) {
                            return {
                              emoji: "✅",
                              label: "Pago",
                              className: "bg-emerald-500/20 text-emerald-400",
                              time: invite.used_at,
                            };
                          }
                          if (invite.payment_link_clicked_at) {
                            return {
                              emoji: "💳",
                              label: "Checkout",
                              className: "bg-amber-500/20 text-amber-400",
                              time: invite.payment_link_clicked_at,
                            };
                          }
                          if (invite.email_opened_at) {
                            return {
                              emoji: "👀",
                              label: "Visto",
                              className: "bg-blue-500/20 text-blue-400",
                              time: invite.email_opened_at,
                            };
                          }
                          return {
                            emoji: "✉️",
                            label: "Enviado",
                            className: "bg-secondary text-muted-foreground",
                            time: invite.created_at,
                          };
                        };

                        const funnel = getFunnelBadge();

                        return (
                          <tr key={invite.id} className="border-b border-border/50 hover:bg-secondary/30">
                            <td className="p-3">
                              <p className="font-medium text-foreground">{invite.name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{invite.email}</p>
                            </td>
                            <td className="p-3 hidden md:table-cell text-foreground">
                              {invite.plan_value ? `R$ ${invite.plan_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${funnel.className}`}>
                                {funnel.emoji} {funnel.label}
                              </span>
                              {funnel.time && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatDistanceToNow(new Date(funnel.time), { addSuffix: true, locale: ptBR })}
                                </p>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1 flex-wrap">
                                {accountCreated && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    onClick={() => setCredentialInvite(invite)}
                                  >
                                    <Eye size={12} /> Credenciais
                                  </Button>
                                )}
                                {!paymentConfirmed && invite.status === "pending" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1 text-xs"
                                      disabled={sendingEmail}
                                      onClick={async () => {
                                        setSendingEmail(true);
                                        try {
                                          // Try to get the plan info for the email
                                          let planDescription = invite.plan_value
                                            ? `R$ ${invite.plan_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                            : "Shape Insano PRO";

                                          // Fetch plan name if subscription_plan_id exists
                                          if ((invite as any).subscription_plan_id) {
                                            const { data: planData } = await supabase
                                              .from("subscription_plans")
                                              .select("name, price")
                                              .eq("id", (invite as any).subscription_plan_id)
                                              .single();
                                            if (planData) {
                                              planDescription = `${planData.name} - ${formatCurrency(planData.price)}`;
                                            }
                                          }

                                          const paymentLink = (invite as any).invoice_url;
                                          if (!paymentLink) {
                                            toast.error("Link de pagamento não disponível para reenvio. Gere um novo convite.");
                                            return;
                                          }

                                          const sent = await sendPaymentEmail(
                                            invite.email,
                                            invite.name || "",
                                            paymentLink,
                                            planDescription
                                          );
                                          if (sent) {
                                            toast.success("E-mail de pagamento reenviado!");
                                          } else {
                                            toast.error("Erro ao reenviar e-mail.");
                                          }
                                        } catch (e: any) {
                                          toast.error("Erro: " + (e.message || ""));
                                        } finally {
                                          setSendingEmail(false);
                                        }
                                      }}
                                    >
                                      {sendingEmail ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Mail size={12} />
                                      )}
                                      Reenviar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="gap-1 text-xs text-destructive hover:text-destructive"
                                      disabled={cancelingInvite === invite.id}
                                      onClick={async () => {
                                        setCancelingInvite(invite.id);
                                        try {
                                          const { error } = await supabase
                                            .from("invites")
                                            .delete()
                                            .eq("id", invite.id);
                                          if (error) throw error;
                                          toast.success("Convite cancelado!");
                                          queryClient.invalidateQueries({ queryKey: ["closer-invites"] });
                                        } catch (e: any) {
                                          toast.error("Erro ao cancelar: " + (e.message || ""));
                                        } finally {
                                          setCancelingInvite(null);
                                        }
                                      }}
                                    >
                                      {cancelingInvite === invite.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Ban size={12} />
                                      )}
                                      Cancelar
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Credential Detail Modal */}
      <Dialog open={!!credentialInvite} onOpenChange={(open) => !open && setCredentialInvite(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-cinzel flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Credenciais do Aluno
            </DialogTitle>
          </DialogHeader>
          {credentialInvite && (
            <div className="space-y-4 mt-2">
              <div className="space-y-3 bg-secondary/50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium text-foreground">{credentialInvite.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">URL de Acesso</p>
                  <p className="text-sm font-medium text-foreground break-all">{window.location.origin}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Login (E-mail)</p>
                  <p className="text-sm font-medium text-foreground">{credentialInvite.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Senha (CPF)</p>
                  <p className="text-sm font-medium text-foreground">{credentialInvite.cpf || "—"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2"
                  variant="outline"
                  onClick={() => {
                    const text = `🔥 Shape Insano PRO\n\nAcesse: ${window.location.origin}\nLogin: ${credentialInvite.email}\nSenha: ${credentialInvite.cpf || "—"}\n\nFaça seu primeiro acesso!`;
                    safeCopy(text, "Dados copiados!");
                  }}
                >
                  <Copy size={16} /> Copiar
                </Button>
                <Button
                  className="flex-1 gap-2"
                  disabled={sendingEmail}
                  onClick={async () => {
                    setSendingEmail(true);
                    const sent = await sendCredentialsEmail(
                      credentialInvite.email,
                      credentialInvite.name || "",
                      credentialInvite.cpf || "",
                    );
                    setSendingEmail(false);
                    if (sent) {
                      toast.success("E-mail reenviado com sucesso!");
                    } else {
                      toast.error("Erro ao reenviar e-mail.");
                    }
                  }}
                >
                  {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail size={16} />}
                  Reenviar E-mail
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <KpiDetailModal
        open={activeModal !== null}
        onOpenChange={(open) => !open && setActiveModal(null)}
        title={activeModal === "total" ? "Todos os Convites" : activeModal === "convertidos" ? "Convites Convertidos" : activeModal === "pendentes" ? "Convites Pendentes" : activeModal === "valor" ? "Valor Convertido" : ""}
        description={activeModal === "total" ? `${total} convites gerados` : activeModal === "convertidos" ? `${used} convites convertidos em alunos` : activeModal === "pendentes" ? `${pending} convites aguardando ativação` : activeModal === "valor" ? `R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em vendas` : ""}
        items={(() => {
          if (!invites) return [];
          const filtered = activeModal === "convertidos" ? invites.filter(i => i.status === "used") :
            activeModal === "pendentes" ? invites.filter(i => i.status === "pending") :
            activeModal === "valor" ? invites.filter(i => i.status === "used" && i.plan_value) :
            invites;
          return filtered.map(i => ({
            id: i.id,
            title: i.name || i.email,
            subtitle: `${i.email} · ${new Date(i.created_at).toLocaleDateString("pt-BR")}${i.plan_value ? ` · R$ ${i.plan_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`,
            badge: i.status === "used" ? "Convertido" : i.status === "pending" ? "Pendente" : "Expirado",
            badgeVariant: i.status === "used" ? "success" as const : i.status === "pending" ? "warning" as const : "danger" as const,
            actionLabel: i.status === "pending" ? "Copiar link" : undefined,
            onAction: i.status === "pending" ? () => copyLink(i.token) : undefined,
          }));
        })()}
      />
    </div>
  );
};

export default CloserDashboard;
