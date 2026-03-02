import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Search, Loader2, Trash2, UtensilsCrossed, BookOpen, Upload } from "lucide-react";
import DietTemplatesList from "@/components/especialista/DietTemplatesList";

const categories = [
  "proteínas", "carboidratos", "gorduras", "frutas", "vegetais",
  "laticínios", "grãos", "suplementos", "outros",
];

interface FoodForm {
  name: string;
  portion: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  category: string;
}

const emptyForm: FoodForm = {
  name: "", portion: "100g", calories: "", protein: "", carbs: "", fat: "", fiber: "", category: "outros",
};

const EspecialistaAlimentos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FoodForm>(emptyForm);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleImportTBCA = async () => {
    if (importing) return;
    setImporting(true);
    setImportProgress(10);
    try {
      // Fetch CSV from public folder
      const csvResp = await fetch("/tbca_final.csv");
      if (!csvResp.ok) throw new Error("CSV não encontrado");
      const csvText = await csvResp.text();
      setImportProgress(30);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      // Send to edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(
        `${supabaseUrl}/functions/v1/import-foods`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "text/csv",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: csvText,
        }
      );
      setImportProgress(80);

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erro na importação");

      setImportProgress(100);
      toast.success(`Importados ${result.inserted} alimentos! (${result.errors} erros)`);
      queryClient.invalidateQueries({ queryKey: ["food-database"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    } finally {
      setImporting(false);
      setTimeout(() => setImportProgress(0), 2000);
    }
  };

  const { data: foods, isLoading } = useQuery({
    queryKey: ["food-database", search, filterCategory],
    queryFn: async () => {
      let query = supabase.from("food_database").select("*").order("name");
      if (search.trim()) query = query.ilike("name", `%${search.trim()}%`);
      if (filterCategory) query = query.eq("category", filterCategory);
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: FoodForm) => {
      const { error } = await supabase.from("food_database").insert({
        name: input.name, portion: input.portion,
        calories: parseFloat(input.calories) || 0, protein: parseFloat(input.protein) || 0,
        carbs: parseFloat(input.carbs) || 0, fat: parseFloat(input.fat) || 0,
        fiber: parseFloat(input.fiber) || 0, category: input.category, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alimento adicionado!");
      queryClient.invalidateQueries({ queryKey: ["food-database"] });
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("food_database").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alimento removido");
      queryClient.invalidateQueries({ queryKey: ["food-database"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold gold-text-gradient">Base de Alimentos</h1>
        <p className="text-sm text-muted-foreground">Gerencie alimentos e templates de dieta</p>
        {importing && (
          <Progress value={importProgress} className="mt-2 h-2" />
        )}
      </div>

      <Tabs defaultValue="alimentos" className="space-y-4">
        <TabsList className="bg-secondary/30 border border-border/50">
          <TabsTrigger value="alimentos" className="gap-1.5 data-[state=active]:bg-accent/20 data-[state=active]:text-accent">
            <UtensilsCrossed size={14} />
            Alimentos
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 data-[state=active]:bg-accent/20 data-[state=active]:text-accent">
            <BookOpen size={14} />
            Templates de Dieta
          </TabsTrigger>
        </TabsList>

        {/* ─── ALIMENTOS TAB ─── */}
        <TabsContent value="alimentos" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar alimento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background border-border" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterCategory ?? "all"} onValueChange={(v) => setFilterCategory(v === "all" ? null : v)}>
                <SelectTrigger className="flex-1 sm:w-[160px] bg-background border-border text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 whitespace-nowrap" size="sm"><Plus size={16} /> <span className="hidden sm:inline">Novo Alimento</span><span className="sm:hidden">Novo</span></Button>
                </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-cinzel">Adicionar Alimento</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-background border-border" placeholder="Ex: Peito de frango grelhado" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Porção</Label>
                      <Input value={form.portion} onChange={(e) => setForm({ ...form, portion: e.target.value })} className="bg-background border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(["calories", "protein", "carbs", "fat"] as const).map((field) => (
                      <div key={field} className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">
                          {field === "calories" ? "Kcal" : field === "protein" ? "Prot (g)" : field === "carbs" ? "Carb (g)" : "Gord (g)"}
                        </Label>
                        <Input type="number" value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="bg-background border-border text-xs" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fibra (g)</Label>
                    <Input type="number" value={form.fiber} onChange={(e) => setForm({ ...form, fiber: e.target.value })} className="bg-background border-border" />
                  </div>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Mobile: card list */}
                  <div className="md:hidden divide-y divide-border/50">
                    {(foods ?? []).map((f) => (
                      <div key={f.id} className="p-3 flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{f.category} · {f.portion}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span><span className="font-semibold text-foreground">{f.calories}</span> kcal</span>
                            <span>P <span className="font-semibold text-foreground">{f.protein}</span></span>
                            <span>C <span className="font-semibold text-foreground">{f.carbs}</span></span>
                            <span>G <span className="font-semibold text-foreground">{f.fat}</span></span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-8 w-8 p-0 shrink-0" onClick={() => deleteMutation.mutate(f.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                    {(foods ?? []).length === 0 && (
                      <p className="p-6 text-center text-muted-foreground text-sm">Nenhum alimento cadastrado.</p>
                    )}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 text-muted-foreground font-medium">Alimento</th>
                          <th className="text-left p-3 text-muted-foreground font-medium">Porção</th>
                          <th className="text-right p-3 text-muted-foreground font-medium">Kcal</th>
                          <th className="text-right p-3 text-muted-foreground font-medium">P (g)</th>
                          <th className="text-right p-3 text-muted-foreground font-medium">C (g)</th>
                          <th className="text-right p-3 text-muted-foreground font-medium">G (g)</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(foods ?? []).map((f) => (
                          <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30">
                            <td className="p-3">
                              <p className="font-medium text-foreground">{f.name}</p>
                              <span className="text-[10px] text-muted-foreground uppercase">{f.category}</span>
                            </td>
                            <td className="p-3 text-muted-foreground">{f.portion}</td>
                            <td className="p-3 text-right text-foreground font-medium">{f.calories}</td>
                            <td className="p-3 text-right text-foreground">{f.protein}</td>
                            <td className="p-3 text-right text-foreground">{f.carbs}</td>
                            <td className="p-3 text-right text-foreground">{f.fat}</td>
                            <td className="p-3">
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
                                <Trash2 size={14} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {(foods ?? []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">Nenhum alimento cadastrado.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TEMPLATES TAB ─── */}
        <TabsContent value="templates">
          <DietTemplatesList />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EspecialistaAlimentos;
