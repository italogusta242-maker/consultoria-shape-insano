import { useState, useEffect } from "react";
import { SFX } from "@/hooks/useSoundEffects";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Timer, ArrowLeft, Check, Flame, Loader2, ChevronDown, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface ExerciseSet {
  targetReps: number;
  actualReps: number | null;
  weight: number | null;
  done: boolean;
}

interface Exercise {
  name: string;
  videoUrl: string | null;
  sets: ExerciseSet[];
}

const lastSessionHistory: Record<string, { weight: number; reps: number }[]> = {
  "Supino Inclinado": [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }, { weight: 42, reps: 9 }, { weight: 42, reps: 8 }],
  "Remada Curvada": [{ weight: 35, reps: 10 }, { weight: 35, reps: 10 }, { weight: 37, reps: 9 }, { weight: 37, reps: 9 }],
  "Desenvolvimento Militar": [{ weight: 20, reps: 12 }, { weight: 20, reps: 12 }, { weight: 22, reps: 10 }],
  "Agachamento": [{ weight: 60, reps: 8 }, { weight: 60, reps: 8 }, { weight: 65, reps: 7 }, { weight: 65, reps: 6 }],
  "Barra Fixa": [{ weight: 0, reps: 8 }, { weight: 0, reps: 7 }, { weight: 0, reps: 6 }],
};

const buildExercise = (name: string, numSets: number, targetReps: number, videoUrl: string | null): Exercise => {
  const history = lastSessionHistory[name] || [];
  return {
    name,
    videoUrl,
    sets: Array(numSets).fill(null).map((_, i) => ({
      targetReps,
      actualReps: history[i]?.reps ?? null,
      weight: history[i]?.weight ?? null,
      done: false,
    })),
  };
};

const initialExercises: Exercise[] = [
  buildExercise("Supino Inclinado", 4, 10, null),
  buildExercise("Remada Curvada", 4, 10, null),
  buildExercise("Desenvolvimento Militar", 3, 12, null),
  buildExercise("Agachamento", 4, 8, null),
  buildExercise("Barra Fixa", 3, 8, null),
];

const BattleMode = () => {
  const navigate = useNavigate();
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!running || complete) return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [running, complete]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const allDone = exercises.every((ex) => ex.sets.every((s) => s.done));

  const confirmSet = (exIndex: number, setIndex: number) => {
    const updated = [...exercises];
    const set = updated[exIndex].sets[setIndex];
    if (set.weight === null || set.actualReps === null) {
      toast.error("Preencha carga e repetições");
      return;
    }
    set.done = true;
    setExercises(updated);
    try { SFX.confirm(); } catch {}

    if (updated.every((ex) => ex.sets.every((s) => s.done))) {
      setComplete(true);
      setRunning(false);
      toast.success("Treino concluído!");
      try { SFX.victory(); } catch {}
    }
  };

  const updateSet = (exIndex: number, setIndex: number, field: "weight" | "actualReps", value: string) => {
    const updated = [...exercises];
    const num = value === "" ? null : Number(value);
    updated[exIndex].sets[setIndex][field] = num;
    setExercises(updated);
  };

  const exerciseDoneCount = (ex: Exercise) => ex.sets.filter((s) => s.done).length;

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Dumbbell size={20} className="text-primary" />
          <span className="font-cinzel font-bold text-primary text-sm">EXECUÇÃO DE TREINO</span>
        </div>
        <div />
      </div>

      {/* Timer */}
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center mb-6">
        <div className={`inline-block rounded-2xl px-8 py-3 border-2 ${running ? "border-primary animate-pulse-glow" : "border-border"}`}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Tempo de Treino</p>
          <p className="font-cinzel text-3xl font-bold text-foreground tabular-nums">{formatTime(timer)}</p>
        </div>
      </motion.div>

      {/* Exercise list */}
      {!complete && (
        <div className="space-y-2 mb-6">
          {exercises.map((ex, exIdx) => {
            const isExpanded = expandedIndex === exIdx;
            const doneCount = exerciseDoneCount(ex);
            const allSetsDone = doneCount === ex.sets.length;

            return (
              <motion.div key={exIdx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: exIdx * 0.05 }}
                className={`rounded-xl border overflow-hidden transition-all ${allSetsDone ? "bg-accent/10 border-accent/30" : "bg-card border-border"}`}
              >
                <button onClick={() => setExpandedIndex(isExpanded ? null : exIdx)} className="w-full flex items-center gap-3 p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allSetsDone ? "gold-gradient" : "bg-secondary"}`}>
                    {allSetsDone ? <Check size={16} className="text-accent-foreground" /> : <span className="text-xs text-muted-foreground">{exIdx + 1}</span>}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-semibold ${allSetsDone ? "text-accent line-through" : "text-foreground"}`}>{ex.name}</p>
                    <p className="text-xs text-muted-foreground">{doneCount}/{ex.sets.length} séries</p>
                  </div>
                  <div className={`w-7 h-7 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 space-y-2">
                        <div className="grid grid-cols-[1fr_4fr_4fr_3fr] gap-2 text-[10px] text-muted-foreground uppercase tracking-wider px-1">
                          <span>Série</span><span>Carga (kg)</span><span>Reps</span><span></span>
                        </div>
                        {ex.sets.map((set, setIdx) => (
                          <div key={setIdx} className={`grid grid-cols-[1fr_4fr_4fr_3fr] gap-2 items-center p-2 rounded-lg ${set.done ? "bg-accent/10" : "bg-secondary/50"}`}>
                            <span className="text-xs font-semibold text-muted-foreground text-center">{setIdx + 1}</span>
                            <Input type="number" placeholder="kg" value={set.weight ?? ""} onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)} disabled={set.done} className="h-8 text-xs bg-background border-border text-center" />
                            <Input type="number" placeholder={`${set.targetReps}`} value={set.actualReps ?? ""} onChange={(e) => updateSet(exIdx, setIdx, "actualReps", e.target.value)} disabled={set.done} className="h-8 text-xs bg-background border-border text-center" />
                            {set.done ? (
                              <div className="flex justify-center"><Check size={16} className="text-accent" /></div>
                            ) : (
                              <button onClick={() => confirmSet(exIdx, setIdx)} className="h-8 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-colors">OK</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Complete overlay */}
      {complete && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center mt-8">
          <motion.div
            animate={{ boxShadow: ["0 0 20px hsl(43 76% 53% / 0.2)", "0 0 60px hsl(43 76% 53% / 0.5)", "0 0 20px hsl(43 76% 53% / 0.2)"] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center"
          >
            <Dumbbell className="text-accent" size={40} />
          </motion.div>
          <h2 className="font-cinzel text-xl font-bold text-foreground mb-2">TREINO CONCLUÍDO!</h2>
          <p className="text-muted-foreground text-sm mb-1">Duração: {formatTime(timer)}</p>

          <div className="bg-card border border-border rounded-xl p-4 my-4 text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Resumo do Treino</p>
            {exercises.map((ex, i) => {
              const vol = ex.sets.reduce((acc, s) => acc + (s.weight ?? 0) * (s.actualReps ?? 0), 0);
              return (
                <div key={i} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                  <span className="text-foreground">{ex.name}</span>
                  <span className="text-accent font-semibold">{vol.toLocaleString()} kg</span>
                </div>
              );
            })}
            <div className="flex justify-between text-sm pt-2 mt-1 border-t border-border">
              <span className="font-cinzel font-bold text-foreground">Volume Total</span>
              <span className="font-cinzel font-bold text-accent">
                {exercises.reduce((acc, ex) => acc + ex.sets.reduce((a, s) => a + (s.weight ?? 0) * (s.actualReps ?? 0), 0), 0).toLocaleString()} kg
              </span>
            </div>
          </div>

          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate("/")}
            className="px-8 py-3 gold-gradient text-accent-foreground font-cinzel font-bold rounded-lg gold-shadow tracking-wider"
          >
            VOLTAR AO INÍCIO
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default BattleMode;
