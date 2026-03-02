import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, QrCode, CreditCard, Send, Loader2, User, Copy, Check,
  CheckCircle2, Clock, XCircle, AlertTriangle, RefreshCw, Receipt,
} from "lucide-react";

interface ChargeResult {
  payment: any;
  pix?: { encodedImage: string; payload: string };
  invite_id?: string;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "text-yellow-500" },
  paid: { label: "Pago", icon: CheckCircle2, className: "text-green-500" },
  overdue: { label: "Vencido", icon: AlertTriangle, className: "text-red-500" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "text-muted-foreground" },
};

const AdminCobrar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [chargeMode, setChargeMode] = useState<"one_time" | "recurring">("one_time");
  const [billingType, setBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [installmentCount, setInstallmentCount] = useState<number>(1);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch students with profiles
  const { data: students } = useQuery({
    queryKey: ["admin_students_charge", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, nome, email, cpf, status")
        .order("nome");

      if (searchTerm.length >= 2) {
        query = query.or(`nome.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch active plans
  const { data: plans } = useQuery({
    queryKey: ["active_plans_charge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("price");
      if (error) throw error;
      return data;
    },
  });

  // Fetch recent charges (invites created by admin)
  const { data: recentCharges } = useQuery({
    queryKey: ["recent_admin_charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("id, name, email, plan_value, payment_status, created_at, status")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const selectedStudent = students?.find((s) => s.id === selectedStudentId);
  const selectedPlan = plans?.find((p: any) => p.id === selectedPlanId);

  const chargeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudentId || !selectedPlanId) throw new Error("Selecione aluno e plano");

      const body: Record<string, unknown> = {
          action: chargeMode === "recurring" ? "create_subscription" : "admin_create_charge",
          student_id: selectedStudentId,
          plan_id: selectedPlanId,
          billing_type: billingType,
          idempotency_key: `admin_charge_${selectedStudentId}_${selectedPlanId}_${Date.now()}`,
        };

        if (billingType === "CREDIT_CARD" && installmentCount > 1 && chargeMode === "one_time") {
          body.installment_count = installmentCount;
        }

        const { data, error } = await supabase.functions.invoke("asaas-payments", { body });

      if (error) throw new Error(error.message || "Erro ao gerar cobrança");
      if (data?.error) throw new Error(data.error);
      return data as ChargeResult;
    },
    onSuccess: (data) => {
      setChargeResult(data);
      setResultDialogOpen(true);
      toast.success("Cobrança gerada com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const copyPix = async (payload: string) => {
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step 1: Select Student */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">1</span>
                Selecionar Aluno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  placeholder="Buscar por nome, e-mail ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {students && students.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-1">
                  {students.map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-md text-left text-sm transition-colors ${
                        selectedStudentId === s.id
                          ? "bg-primary/20 text-foreground"
                          : "hover:bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      <User size={16} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-foreground">{s.nome || "Sem nome"}</p>
                        <p className="text-xs truncate">{s.email}</p>
                      </div>
                      {s.cpf && <span className="text-xs shrink-0">{s.cpf}</span>}
                    </button>
                  ))}
                </div>
              )}

              {selectedStudent && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium text-foreground">{selectedStudent.nome}</p>
                  <p className="text-xs text-muted-foreground">{selectedStudent.email} · {selectedStudent.cpf || "Sem CPF"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Select Plan */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">2</span>
                Selecionar Plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um plano..." />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)} / {p.duration_months === 1 ? "mês" : `${p.duration_months} meses`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPlan && (
                <div className="mt-3 p-3 rounded-md bg-secondary/50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">{selectedPlan.name}</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(selectedPlan.price)}</span>
                  </div>
                  {selectedPlan.description && (
                    <p className="text-xs text-muted-foreground mt-1">{selectedPlan.description}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Charge Mode + Billing Type + Submit */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold">3</span>
                Tipo de Cobrança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Charge Mode: One-time vs Recurring */}
              <Select value={chargeMode} onValueChange={(v) => {
                setChargeMode(v as "one_time" | "recurring");
                if (v === "recurring") {
                  setBillingType("CREDIT_CARD");
                  setInstallmentCount(1);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">
                    <span className="flex items-center gap-2">
                      <Receipt size={14} /> Avulso (cobrança única)
                    </span>
                  </SelectItem>
                  <SelectItem value="recurring">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} /> Recorrente (mensal automático)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Method - only for one_time */}
              {chargeMode === "one_time" && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Método de Pagamento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setBillingType("PIX"); setInstallmentCount(1); }}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                        billingType === "PIX"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <QrCode size={20} className={billingType === "PIX" ? "text-primary" : "text-muted-foreground"} />
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">PIX</p>
                        <p className="text-xs text-muted-foreground">Gera QR Code</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setBillingType("CREDIT_CARD")}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                        billingType === "CREDIT_CARD"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <CreditCard size={20} className={billingType === "CREDIT_CARD" ? "text-primary" : "text-muted-foreground"} />
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">Cartão</p>
                        <p className="text-xs text-muted-foreground">Link de pagamento</p>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* Installments - only for credit card one_time */}
              {chargeMode === "one_time" && billingType === "CREDIT_CARD" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Parcelas</p>
                  <Select value={String(installmentCount)} onValueChange={(v) => setInstallmentCount(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1 ? "À vista" : `${n}x`}
                          {selectedPlan && n > 1 && ` de ${formatCurrency(selectedPlan.price / n)}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {chargeMode === "recurring" && (
                <div className="p-3 rounded-md bg-secondary/50 text-xs text-muted-foreground">
                  <p>⚡ Será criada uma assinatura mensal automática no cartão do aluno.</p>
                </div>
              )}

              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!selectedStudentId || !selectedPlanId || chargeMutation.isPending}
                onClick={() => chargeMutation.mutate()}
              >
                {chargeMutation.isPending ? (
                  <><Loader2 className="animate-spin" size={16} /> Gerando cobrança...</>
                ) : (
                  <><Send size={16} /> {chargeMode === "recurring" ? "Criar Assinatura" : "Gerar Cobrança"}</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Recent Charges */}
        <div>
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobranças Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentCharges?.length ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma cobrança registrada</p>
              ) : (
                <div className="space-y-2">
                  {recentCharges.map((c: any) => {
                    const st = statusConfig[c.payment_status || "pending"] || statusConfig.pending;
                    const StIcon = st.icon;
                    return (
                      <div key={c.id} className="p-2.5 rounded-md bg-secondary/30 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground truncate">{c.name || c.email}</span>
                          <Badge variant="outline" className={`text-xs gap-1 ${st.className}`}>
                            <StIcon size={10} />
                            {st.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleDateString("pt-BR")}
                          </span>
                          {c.plan_value && (
                            <span className="text-xs font-medium text-primary">
                              {formatCurrency(c.plan_value)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Result Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="text-primary" size={20} />
              Cobrança Gerada!
            </DialogTitle>
          </DialogHeader>

          {chargeResult && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-secondary/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID Pagamento:</span>
                  <span className="font-mono text-xs text-foreground">{chargeResult.payment?.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{chargeResult.payment?.status}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-bold text-primary">
                    {chargeResult.payment?.value && formatCurrency(chargeResult.payment.value)}
                  </span>
                </div>
              </div>

              {chargeResult.pix && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground text-center">QR Code PIX</p>
                  {chargeResult.pix.encodedImage && (
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${chargeResult.pix.encodedImage}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 rounded-lg"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={chargeResult.pix.payload}
                      readOnly
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyPix(chargeResult.pix!.payload)}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                📧 E-mail de cobrança enviado automaticamente ao aluno
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResultDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCobrar;
