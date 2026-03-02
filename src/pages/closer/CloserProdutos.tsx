import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Package, Repeat, QrCode, CreditCard, Plus, Edit3, Trash2 } from "lucide-react";

interface PlanForm {
  name: string;
  price: string;
  duration_months: string;
  billing_type: string;
  payment_method: string;
  max_installments: string;
  description: string;
  specialist_limitation: string;
}

const emptyForm: PlanForm = {
  name: "",
  price: "",
  duration_months: "1",
  billing_type: "recurring",
  payment_method: "PIX",
  max_installments: "1",
  description: "",
  specialist_limitation: "nenhum",
};

const CloserProdutos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["closer-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        duration_months: parseInt(form.duration_months),
        billing_type: form.billing_type,
        payment_method: form.billing_type === "recurring" ? "CREDIT_CARD" : form.payment_method,
        max_installments: form.payment_method === "CREDIT_CARD" && form.billing_type === "one_time" ? parseInt(form.max_installments) : 1,
        description: form.description || null,
        specialist_limitation: form.specialist_limitation,
      } as any;

      if (editingId) {
        const { error } = await supabase.from("subscription_plans").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscription_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-subscription-plans"] });
      toast.success(editingId ? "Plano atualizado!" : "Plano criado!");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("subscription_plans").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-subscription-plans"] });
      toast.success("Status atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["closer-subscription-plans"] });
      toast.success("Plano excluído!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: any) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      price: String(plan.price),
      duration_months: String(plan.duration_months),
      billing_type: plan.billing_type || "recurring",
      payment_method: plan.payment_method || "PIX",
      max_installments: String(plan.max_installments || 1),
      description: plan.description || "",
      specialist_limitation: plan.specialist_limitation || "nenhum",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-cinzel text-2xl font-bold text-foreground">Planos Disponíveis</h1>
          <p className="text-sm text-muted-foreground">Gerencie e crie planos para venda</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> Novo Plano
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !plans || plans.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Package size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum plano disponível.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
              Criar primeiro plano
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan: any) => (
            <Card
              key={plan.id}
              className={`bg-card border-border transition-opacity ${!plan.active ? "opacity-50" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-medium">{plan.name}</CardTitle>
                  <Badge variant={plan.active ? "default" : "secondary"} className="text-xs">
                    {plan.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{formatCurrency(plan.price)}</span>
                  <span className="text-xs text-muted-foreground">
                    / {plan.duration_months === 1 ? "mês" : `${plan.duration_months} meses`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {plan.billing_type === "recurring" ? (
                    <>
                      <Repeat size={14} className="text-primary" />
                      <span className="text-xs text-muted-foreground">Recorrente · Cartão</span>
                    </>
                  ) : (
                    <>
                      {plan.payment_method === "PIX" ? (
                        <QrCode size={14} className="text-primary" />
                      ) : (
                        <CreditCard size={14} className="text-primary" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        Avulso · {plan.payment_method === "PIX" ? "PIX" : "Cartão"}
                      </span>
                      {plan.payment_method === "CREDIT_CARD" && (plan.max_installments || 1) > 1 && (
                        <Badge variant="outline" className="text-xs">até {plan.max_installments}x</Badge>
                      )}
                    </>
                   )}
                  {plan.specialist_limitation && plan.specialist_limitation !== "nenhum" && (
                    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">
                      {plan.specialist_limitation === "apenas_nutricionista" ? "Só Nutri" : "Só Preparador"}
                    </Badge>
                  )}
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground">{plan.description}</p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={plan.active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: plan.id, active: checked })}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                          <Trash2 size={14} /> Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir plano "{plan.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O plano será removido permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(plan.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => openEdit(plan)}>
                      <Edit3 size={14} /> Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome do plano</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Trimestral PIX"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Preço (R$)</label>
                <Input
                  type="number"
                  min="5"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="297.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Duração (meses)</label>
                <Input
                  type="number"
                  min="1"
                  max="36"
                  value={form.duration_months}
                  onChange={(e) => setForm({ ...form, duration_months: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo de cobrança</label>
              <Select value={form.billing_type} onValueChange={(v) => setForm({ ...form, billing_type: v, ...(v === "recurring" ? { payment_method: "CREDIT_CARD", max_installments: "1" } : {}) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">
                    <span className="flex items-center gap-2"><Repeat size={14} /> Recorrente (mensal automático)</span>
                  </SelectItem>
                  <SelectItem value="one_time">
                    <span className="flex items-center gap-2"><CreditCard size={14} /> Avulso (cobrança única)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.billing_type === "one_time" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Método de pagamento</label>
                <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v, ...(v === "PIX" ? { max_installments: "1" } : {}) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX"><span className="flex items-center gap-2"><QrCode size={14} /> PIX</span></SelectItem>
                    <SelectItem value="CREDIT_CARD"><span className="flex items-center gap-2"><CreditCard size={14} /> Cartão de Crédito</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.billing_type === "one_time" && form.payment_method === "CREDIT_CARD" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Parcelas máximas</label>
                <Select value={form.max_installments} onValueChange={(v) => setForm({ ...form, max_installments: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 1 ? "À vista (sem parcelamento)" : `Até ${n}x`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.billing_type === "recurring" && (
              <div className="p-3 rounded-md bg-secondary/50 text-xs text-muted-foreground">
                ⚡ Assinatura mensal automática no cartão do aluno.
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Limitações</label>
              <Select value={form.specialist_limitation} onValueChange={(v) => setForm({ ...form, specialist_limitation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhuma (ambos os especialistas)</SelectItem>
                  <SelectItem value="apenas_nutricionista">Apenas Nutricionista</SelectItem>
                  <SelectItem value="apenas_preparador">Apenas Preparador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição visível na cobrança..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.price || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              {editingId ? "Salvar" : "Criar Plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CloserProdutos;
