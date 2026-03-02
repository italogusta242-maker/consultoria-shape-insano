import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dumbbell, Apple, Brain, Edit3, Check, X, History,
  Sparkles, ChevronRight,
} from "lucide-react";

const mockPlans = [
  {
    id: 1,
    user: "Marcus Vinícius",
    class: "Gladius",
    type: "treino",
    status: "ativo",
    lastEdit: "IA - 2 dias atrás",
    exercises: [
      { name: "Supino Reto", sets: "4x10", load: "80kg", notes: "" },
      { name: "Desenvolvimento", sets: "3x12", load: "30kg", notes: "" },
      { name: "Crucifixo", sets: "3x15", load: "14kg", notes: "" },
      { name: "Tríceps Corda", sets: "3x12", load: "25kg", notes: "" },
    ],
  },
  {
    id: 2,
    user: "Julia Santos",
    class: "Centurio",
    type: "nutricao",
    status: "revisão",
    lastEdit: "Dr. Ana Costa - Hoje",
    meals: [
      { time: "07:00", meal: "Café da manhã", items: "Ovos, aveia, frutas", kcal: 450 },
      { time: "10:00", meal: "Lanche", items: "Whey + banana", kcal: 250 },
      { time: "12:30", meal: "Almoço", items: "Frango, arroz integral, legumes", kcal: 650 },
      { time: "15:30", meal: "Lanche", items: "Castanhas, iogurte", kcal: 200 },
      { time: "19:00", meal: "Jantar", items: "Peixe, batata doce, salada", kcal: 550 },
    ],
  },
];

const changeHistory = [
  { date: "12/02/2026", author: "IA", change: "Gerado plano de treino base para Marcus V." },
  { date: "12/02/2026", author: "Dr. Ana Costa", change: "Ajustou carga do Supino de 70kg para 80kg" },
  { date: "11/02/2026", author: "IA", change: "Sugeriu aumento de volume no treino de perna" },
  { date: "10/02/2026", author: "Prof. Carlos", change: "Removeu exercício isométrico por lesão" },
];

const AdminPlanos = () => {
  const [editingExercise, setEditingExercise] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Editor de Planos</h1>
        <p className="text-sm text-muted-foreground">Revise e ajuste os planos gerados pela IA</p>
      </div>

      <Tabs defaultValue="treino" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="treino" className="gap-2"><Dumbbell size={14} /> Treino</TabsTrigger>
          <TabsTrigger value="nutricao" className="gap-2"><Apple size={14} /> Nutrição</TabsTrigger>
          <TabsTrigger value="historico" className="gap-2"><History size={14} /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="treino" className="space-y-4">

          {/* Training Plan */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Marcus Vinícius — Treino A (Peito/Tríceps)</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Última edição: IA - 2 dias atrás</p>
                </div>
                <Badge className="bg-primary/20 text-primary">Gladius</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockPlans[0].exercises?.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 group">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">{ex.sets} · {ex.load}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditingExercise(editingExercise === i ? null : i)}
                    >
                      <Edit3 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full text-xs">
                + Adicionar exercício
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nutricao" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">Julia Santos — Plano Nutricional</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Última edição: Dr. Ana Costa - Hoje</p>
                </div>
                <Badge className="bg-purple-500/20 text-purple-400">Centurio</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockPlans[1].meals?.map((meal, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 group">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs text-muted-foreground w-12">{meal.time}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">{meal.meal}</p>
                        <p className="text-xs text-muted-foreground">{meal.items}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gold font-medium">{meal.kcal} kcal</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit3 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-3 p-2 rounded-md bg-gold/5">
                <span className="text-xs text-muted-foreground">Total diário</span>
                <span className="text-sm font-bold text-gold">2.100 kcal</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Histórico de Alterações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changeHistory.map((ch, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full bg-gold mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{ch.date}</span>
                        <Badge variant="outline" className="text-xs">{ch.author}</Badge>
                      </div>
                      <p className="text-sm text-foreground mt-0.5">{ch.change}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPlanos;
