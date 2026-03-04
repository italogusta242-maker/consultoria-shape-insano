import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SFX } from "@/hooks/useSoundEffects";
import { optimisticFlameUpdate } from "@/lib/flameOptimistic";
import { checkAndUpdateFlame } from "@/lib/flameMotor";
import { onWorkoutStart, onWorkoutFinish } from "@/lib/coachNotifications";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell, Play, ChevronDown, ChevronUp, ArrowLeft, Check,
  Timer, RefreshCw, Weight, Clock, Flame, MessageSquare,
  History, X, AlertTriangle, Trophy, Youtube,
  ClipboardList, Target, TrendingUp, FileText, Share2,
} from "lucide-react";
import WorkoutShareCard from "@/components/training/WorkoutShareCard";
import { useWorkoutShare } from "@/hooks/useWorkoutShare";
import { useFlameState } from "@/hooks/useFlameState";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SetInputPicker from "@/components/training/SetInputPicker";
import { Progress } from "@/components/ui/progress";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getToday } from "@/lib/dateUtils";

// ─── Types ───────────────────────────────────────────────────
interface ExerciseSet {
  targetReps: string;
  weight: number | null;
  actualReps: number | null;
  done: boolean;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  weight: number | null;
  rest: string;
  videoId?: string;
  setsData: ExerciseSet[];
  description?: string;
  gif_url?: string;
  instructions?: string;
}

interface WorkoutGroup {
  name: string;
  exercises: Exercise[];
}

interface TrainingPlan {
  id: string;
  title: string;
  groups: WorkoutGroup[];
  total_sessions: number;
  valid_until: string | null;
  avaliacao_postural?: string | null;
  pontos_melhoria?: string | null;
  objetivo_mesociclo?: string | null;
}

interface WorkoutLog {
  id: string;
  group_name: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  effort_rating: number | null;
  comment: string | null;
  exercises: any;
}

// ─── Training Analysis Cards ────────────────────────────────
const TrainingAnalysisCards = ({ avaliacaoPostural, pontosMelhoria, objetivoMesociclo }: {
  avaliacaoPostural?: string | null;
  pontosMelhoria?: string | null;
  objetivoMesociclo?: string | null;
}) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const cards = [
    { key: "objetivo", label: "Objetivo do Mesociclo", icon: Target, content: objetivoMesociclo },
    { key: "avaliacao", label: "Avaliação Postural", icon: ClipboardList, content: avaliacaoPostural },
    { key: "pontos", label: "Pontos de Melhoria", icon: TrendingUp, content: pontosMelhoria },
  ].filter(c => c.content);

  if (cards.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {cards.map(({ key, label, icon: Icon, content }) => (
        <div key={key} className="bg-secondary/50 border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedCard(expandedCard === key ? null : key)}
            className="w-full flex items-center gap-3 p-3 text-left"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-primary/15 border border-primary/30">
              <Icon size={14} className="text-primary" />
            </div>
            <span className="font-cinzel text-xs font-bold text-foreground flex-1">{label}</span>
            {expandedCard === key ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {expandedCard === key && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3">
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{content}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

// ─── Fallback mock data ──────────────────────────────────────
const fallbackGroups: WorkoutGroup[] = [
  {
    name: "Peito / Ombro / Tríceps",
    exercises: [
      { name: "Supino inclinado com halteres", sets: 3, reps: "8 a 12", weight: 18, rest: "1'30\" a 2'", videoId: "SrqOu55lrYU", setsData: [] },
      { name: "Supino reto com barra", sets: 4, reps: "8 a 10", weight: 40, rest: "2' a 2'30\"", videoId: "rT7DgCr-3pg", setsData: [] },
      { name: "Crucifixo máquina", sets: 3, reps: "10 a 12", weight: 25, rest: "1'30\"", videoId: "Z57CtFmRMxA", setsData: [] },
      { name: "Desenvolvimento máquina", sets: 3, reps: "10 a 12", weight: 20, rest: "1'30\"", videoId: "qEwKCR5JCog", setsData: [] },
      { name: "Elevação lateral com halteres", sets: 3, reps: "12 a 15", weight: 8, rest: "1'", videoId: "3VcKaXpzqRo", setsData: [] },
      { name: "Tríceps máquina", sets: 3, reps: "10 a 12", weight: 30, rest: "1'30\"", videoId: "2-LAMcpzODU", setsData: [] },
      { name: "Tríceps na polia com barra V", sets: 3, reps: "10 a 12", weight: 25, rest: "1'30\"", videoId: "2-LAMcpzODU", setsData: [] },
    ],
  },
  {
    name: "Inferiores",
    exercises: [
      { name: "Agachamento livre", sets: 4, reps: "8 a 10", weight: 60, rest: "2' a 3'", videoId: "ultWZbUMPL8", setsData: [] },
      { name: "Leg press 45°", sets: 4, reps: "10 a 12", weight: 120, rest: "2'", videoId: "IZxyjW7MPJQ", setsData: [] },
      { name: "Cadeira extensora", sets: 3, reps: "12 a 15", weight: 40, rest: "1'30\"", videoId: "YyvSfVjQeL0", setsData: [] },
      { name: "Mesa flexora", sets: 3, reps: "10 a 12", weight: 35, rest: "1'30\"", videoId: "1Tq3QdYUuHs", setsData: [] },
      { name: "Panturrilha em pé", sets: 4, reps: "15 a 20", weight: 50, rest: "1'", videoId: "gwLzBJYoWlI", setsData: [] },
      { name: "Stiff com halteres", sets: 3, reps: "10 a 12", weight: 16, rest: "1'30\"", videoId: "1uDiW5--rAE", setsData: [] },
    ],
  },
  {
    name: "Costas / Bíceps / Ombro",
    exercises: [
      { name: "Puxada frontal", sets: 4, reps: "8 a 12", weight: 45, rest: "1'30\" a 2'", videoId: "CAwf7n6Luuc", setsData: [] },
      { name: "Remada curvada", sets: 4, reps: "8 a 10", weight: 35, rest: "2'", videoId: "kBWAon7ItDw", setsData: [] },
      { name: "Remada unilateral", sets: 3, reps: "10 a 12", weight: 20, rest: "1'30\"", videoId: "pYcpY20QaE8", setsData: [] },
      { name: "Rosca direta com barra", sets: 3, reps: "10 a 12", weight: 18, rest: "1'30\"", videoId: "kwG2ipFRgFo", setsData: [] },
      { name: "Rosca alternada", sets: 3, reps: "10 a 12", weight: 12, rest: "1'", videoId: "sAq_ocpRh_I", setsData: [] },
      { name: "Desenvolvimento Arnold", sets: 3, reps: "10 a 12", weight: 14, rest: "1'30\"", videoId: "6Z15_WdXmVw", setsData: [] },
      { name: "Face pull", sets: 3, reps: "12 a 15", weight: 15, rest: "1'", videoId: "rep-qVOkqgk", setsData: [] },
    ],
  },
];
// ─── Video ID map (exercise name → YouTube ID) with keyword matching ──
const exerciseVideoMap: Record<string, string> = {};
for (const g of fallbackGroups) {
  for (const ex of g.exercises) {
    if (ex.videoId) exerciseVideoMap[ex.name.toLowerCase()] = ex.videoId;
  }
}

// Fuzzy match: find videoId by checking if all keywords from a fallback name appear in the exercise name
const findVideoByKeywords = (exerciseName: string): string | undefined => {
  const normalized = exerciseName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Exact match first
  const exact = exerciseVideoMap[exerciseName.toLowerCase()];
  if (exact) return exact;
  // Keyword match
  for (const [fallbackName, videoId] of Object.entries(exerciseVideoMap)) {
    const fallbackNorm = fallbackName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const keywords = fallbackNorm.split(/\s+/).filter(w => w.length > 2);
    if (keywords.length >= 2 && keywords.every(kw => normalized.includes(kw))) {
      return videoId;
    }
  }
  return undefined;
};

// ─── Helpers ─────────────────────────────────────────────────
const initSetsData = (ex: Exercise): ExerciseSet[] =>
  Array(ex.sets).fill(null).map(() => ({
    targetReps: ex.reps,
    weight: ex.weight,
    actualReps: null,
    done: false,
  }));

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

/** Parse rest string like "1'30\"", "2'", "1'30\" a 2'" into seconds (uses first value) */
const parseRestSeconds = (rest: string): number => {
  if (!rest) return 90;
  const match = rest.match(/(\d+)'(?:\s*(\d+)"?)?/);
  if (!match) return 90;
  const minutes = parseInt(match[1]) || 0;
  const seconds = parseInt(match[2]) || 0;
  return minutes * 60 + seconds;
};

/** Rest countdown timer component */
const RestTimer = ({ seconds, onDone, onSkip }: { seconds: number; onDone: () => void; onSkip: () => void }) => {
  const [remaining, setRemaining] = useState(seconds);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      const rem = Math.max(0, seconds - elapsed);
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(interval);
        try { SFX.confirm(); } catch {}
        onDone();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [seconds, onDone]);

  const pct = seconds > 0 ? (remaining / seconds) * 100 : 0;
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-4 w-64 shadow-xl">
        <p className="font-cinzel text-xs uppercase tracking-widest text-muted-foreground">Descanso</p>
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - pct / 100)}`}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-cinzel text-3xl font-bold text-foreground tabular-nums">
              {min}:{sec.toString().padStart(2, "0")}
            </span>
          </div>
        </div>
        <button
          onClick={onSkip}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
        >
          Pular descanso
        </button>
      </div>
    </motion.div>
  );
};

const calcVolume = (exercises: Exercise[]) => {
  let total = 0;
  exercises.forEach((ex) => {
    ex.setsData.forEach((s) => {
      if (s.done && s.weight && s.actualReps) {
        total += s.weight * s.actualReps;
      }
    });
  });
  return total;
};

const ExerciseVideoThumb = ({ videoId, name }: { videoId?: string; name: string }) => {
  if (!videoId) return null;
  return (
    <a
      href={`https://www.youtube.com/watch?v=${videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block w-full rounded-lg overflow-hidden border border-border group"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
        alt={`Como executar: ${name}`}
        className="w-full h-auto object-cover group-hover:brightness-110 transition-all"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/30 transition-colors">
        <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
          <Youtube size={20} className="text-primary-foreground" />
        </div>
      </div>
      <span className="absolute bottom-1.5 left-2 text-[10px] font-semibold text-white/90 bg-black/60 px-1.5 py-0.5 rounded">
        Ver execução
      </span>
    </a>
  );
};

const calcVolumeFromJson = (exercises: any) => {
  if (!exercises || !Array.isArray(exercises)) return 0;
  let total = 0;
  exercises.forEach((ex: any) => {
    if (ex.setsData && Array.isArray(ex.setsData)) {
      ex.setsData.forEach((s: any) => {
        if (s.done && s.weight && s.actualReps) {
          total += s.weight * s.actualReps;
        }
      });
    }
  });
  return total;
};

// ─── View Types ──────────────────────────────────────────────
type View = "list" | "detail" | "execution" | "complete" | "history" | "share";

const Treinos = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const MAX_WORKOUT_SECONDS = 3 * 60 * 60; // 3 hours

  // ─── Restore execution state from localStorage ─────────────
  const getPersistedExecution = () => {
    try {
      const raw = localStorage.getItem("workout-execution-state");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.date !== getToday()) {
        localStorage.removeItem("workout-execution-state");
        return null;
      }
      return parsed as {
        date: string;
        view: View;
        selectedGroup: number;
        startedAt: string;
        exercises: Exercise[];
        expandedExercise: number | null;
      };
    } catch { return null; }
  };

  const persisted = getPersistedExecution();

  const [view, setView] = useState<View>(persisted?.view === "execution" ? "execution" : "list");
  const [selectedGroup, setSelectedGroup] = useState<number | null>(persisted?.selectedGroup ?? null);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(persisted?.expandedExercise ?? null);
  const [exercises, setExercises] = useState<Exercise[]>(persisted?.exercises ?? []);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [effortRating, setEffortRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [startedAt, setStartedAt] = useState<string>(persisted?.startedAt ?? "");
  const [timerRunning, setTimerRunning] = useState(!!persisted?.startedAt && persisted?.view === "execution");
  const [restTimerData, setRestTimerData] = useState<{ seconds: number } | null>(null);
  const [setPickerData, setSetPickerData] = useState<{ exIdx: number; setIdx: number } | null>(null);

  // Share card
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { shareWorkout, isSharing } = useWorkoutShare();
  const { state: flameState, streak } = useFlameState();

  // Swap exercise state
  const [swapData, setSwapData] = useState<{ exIdx: number; oldName: string; pattern: string | null } | null>(null);

  // Timer computed from startedAt (survives tab changes)
  const [timer, setTimer] = useState(() => {
    if (persisted?.startedAt) {
      return Math.floor((Date.now() - new Date(persisted.startedAt).getTime()) / 1000);
    }
    return 0;
  });

  // ─── DB Queries ────────────────────────────────────────────
  const { data: plan } = useQuery({
    queryKey: ["training-plan", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("training_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TrainingPlan | null;
    },
    enabled: !!user,
    refetchOnMount: "always",
  });

  const { data: workoutHistory = [] } = useQuery({
    queryKey: ["workout-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as WorkoutLog[];
    },
    enabled: !!user,
  });

  // Fetch exercise library for GIF/instructions enrichment
  const { data: exerciseLibrary = [] } = useQuery({
    queryKey: ["exercise-library-student"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_library")
        .select("name, gif_url, instructions, equipment, level, movement_pattern");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const exerciseLibMap = useMemo(() => {
    const map = new Map<string, { gif_url: string | null; instructions: string | null; movement_pattern: string | null; equipment: string | null }>();
    for (const e of exerciseLibrary) {
      map.set(e.name.toLowerCase(), { 
        gif_url: e.gif_url, 
        instructions: e.instructions,
        movement_pattern: e.movement_pattern,
        equipment: e.equipment
      });
    }
    return map;
  }, [exerciseLibrary]);

  const sessionsCompleted = workoutHistory.filter((w) => w.finished_at).length;

  const workoutGroups: WorkoutGroup[] = plan?.groups
    ? (plan.groups as unknown as WorkoutGroup[]).map(g => ({
      ...g,
      exercises: [...g.exercises]
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map(ex => ({
          ...ex,
          videoId: ex.videoId || findVideoByKeywords(ex.name) || undefined,
        })),
    }))
    : fallbackGroups;
  const totalSessions = plan?.total_sessions ?? 50;
  const planTitle = plan?.title ?? "Plano Personalizado";

  // Save workout mutation
  const saveWorkout = useMutation({
    mutationFn: async (data: {
      exercises: Exercise[];
      duration: number;
      effortRating: number | null;
      comment: string;
      groupName: string;
      startedAtOverride?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const resolvedStart = data.startedAtOverride || startedAt;
      // Prevent duplicate inserts for the same session
      const { data: existing } = await supabase
        .from("workouts")
        .select("id")
        .eq("user_id", user.id)
        .eq("started_at", resolvedStart)
        .limit(1);
      if (existing && existing.length > 0) {
        console.warn("Workout already saved for this session, skipping duplicate insert");
        return;
      }
      const { error } = await supabase.from("workouts").insert({
        user_id: user.id,
        exercises: data.exercises as any,
        duration_seconds: data.duration,
        effort_rating: data.effortRating,
        comment: data.comment || null,
        group_name: data.groupName,
        plan_id: plan?.id || null,
        started_at: resolvedStart,
        finished_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onMutate: async () => {
      // REGRA 1: Cancel in-flight queries
      if (user) {
        await queryClient.cancelQueries({ queryKey: ["flame-state", user.id] });
        await queryClient.cancelQueries({ queryKey: ["workout-history"] });
      }
      const previousFlame = user ? queryClient.getQueryData(["flame-state", user.id]) : null;

      // REGRA 2: Optimistic flame update (instant, before DB)
      if (user) {
        optimisticFlameUpdate(queryClient, user.id, { adherenceDelta: 40, forceActive: true, streakIncrement: true });
      }
      return { previousFlame };
    },
    onError: (_err, _vars, context) => {
      // REGRA 3: Rollback
      if (context?.previousFlame && user) {
        queryClient.setQueryData(["flame-state", user.id], context.previousFlame);
      }
    },
    onSuccess: () => {
      // REGRA 4: NO invalidateQueries for flame — only workout-history is safe
      queryClient.invalidateQueries({ queryKey: ["workout-history"] });
      // Background: persist flame to DB
      if (user) {
        checkAndUpdateFlame(user.id);
      }
    },
  });

  // Timer effect — compute from startedAt
  useEffect(() => {
    if (!timerRunning || !startedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setTimer(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, startedAt]);

  // Auto-finalize after 3 hours
  useEffect(() => {
    if (!timerRunning || timer < MAX_WORKOUT_SECONDS) return;
    if (selectedGroup === null) return;
    const groupName = workoutGroups[selectedGroup]?.name ?? "Treino";

    // Auto-save
    setTimerRunning(false);
    saveWorkout.mutate({
      exercises,
      duration: MAX_WORKOUT_SECONDS,
      effortRating: null,
      comment: "Finalizado automaticamente (3h)",
      groupName,
      startedAtOverride: startedAt,
    });

    // Clear persisted state
    localStorage.removeItem("workout-execution-state");
    localStorage.removeItem(`workout-in-progress-${selectedGroup}`);

    toast.success("⏱️ Treino finalizado automaticamente após 3h!");
    setView("list");
    setSelectedGroup(null);
  }, [timer, timerRunning]);

  // Persist execution state to localStorage
  useEffect(() => {
    if (view === "execution" && selectedGroup !== null && startedAt) {
      localStorage.setItem("workout-execution-state", JSON.stringify({
        date: getToday(),
        view,
        selectedGroup,
        startedAt,
        exercises,
        expandedExercise,
      }));
    } else if (view !== "execution") {
      localStorage.removeItem("workout-execution-state");
    }
  }, [view, selectedGroup, startedAt, exercises, expandedExercise]);

  // Determine next group
  const getNextGroupIndex = useCallback(() => {
    if (workoutGroups.length === 0) return 0;
    const counts = workoutGroups.map((g) =>
      workoutHistory.filter((w) => w.group_name === g.name && w.finished_at).length
    );
    return counts.indexOf(Math.min(...counts));
  }, [workoutGroups, workoutHistory]);

  const nextGroupIndex = getNextGroupIndex();

  const openGroup = (index: number) => {
    const group = workoutGroups[index];
    if (!group.exercises || group.exercises.length === 0) {
      toast.error("Este treino ainda não possui exercícios. Aguarde seu preparador configurá-lo.");
      return;
    }
    const storageKey = `workout-in-progress-${index}`;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const todayStr = getToday();
        if (parsed.date === todayStr && parsed.exercises?.length === group.exercises.length) {
          setExercises(parsed.exercises);
          setSelectedGroup(index);
          setExpandedExercise(null);
          setView("detail");
          return;
        }
      }
    } catch { }

    const exs = group.exercises.map((ex) => {
      const setsData = initSetsData(ex);
      const maxWeight = workoutHistory.reduce((max, w) => {
        const exercises = w.exercises as any[];
        if (!exercises) return max;
        for (const histEx of exercises) {
          if (histEx.name === ex.name && histEx.setsData) {
            for (const s of histEx.setsData) {
              if (s.done && s.weight && s.weight > max) max = s.weight;
            }
          }
        }
        return max;
      }, 0);
      if (maxWeight > 0) {
        setsData.forEach(s => { s.weight = maxWeight; });
      }
      return { ...ex, setsData };
    });
    setExercises(exs);
    setSelectedGroup(index);
    setExpandedExercise(null);
    setView("detail");
  };

  // Auto-save exercises to localStorage whenever they change
  useEffect(() => {
    if (selectedGroup === null || exercises.length === 0) return;
    if (view !== "detail" && view !== "execution") return;
    const storageKey = `workout-in-progress-${selectedGroup}`;
    localStorage.setItem(storageKey, JSON.stringify({
      date: getToday(),
      exercises,
    }));
  }, [exercises, selectedGroup, view]);

  const startWorkout = () => {
    setView("execution");
    setTimerRunning(true);
    setTimer(0);
    setStartedAt(new Date().toISOString());
    setExpandedExercise(0);
    // 10% chance "Igor is watching" notification
    if (user) onWorkoutStart(user.id);
  };

  const updateSet = (exIdx: number, setIdx: number, field: "weight" | "actualReps", value: string) => {
    const updated = [...exercises];
    const num = value === "" ? null : Number(value);
    updated[exIdx].setsData[setIdx][field] = num;
    setExercises(updated);
  };

  const confirmSet = (exIdx: number, setIdx: number) => {
    const updated = [...exercises];
    const set = updated[exIdx].setsData[setIdx];
    if (set.weight === null || set.actualReps === null) {
      toast.error("Preencha carga e repetições");
      return;
    }
    set.done = true;
    setExercises(updated);
    try { SFX.confirm(); } catch { }

    // Start rest timer if there are more sets remaining (in this exercise or next)
    const hasMoreSets = updated[exIdx].setsData.some((s, i) => i > setIdx && !s.done)
      || updated.some((ex, i) => i > exIdx && ex.setsData.some(s => !s.done));
    if (hasMoreSets && view === "execution") {
      const restSecs = parseRestSeconds(updated[exIdx].rest);
      setRestTimerData({ seconds: restSecs });
    }
  };

  const completeExercise = (exIdx: number) => {
    const ex = exercises[exIdx];
    const updated = [...exercises];
    updated[exIdx].setsData.forEach((s) => { if (!s.done) s.done = true; });
    setExercises(updated);
    if (exIdx < exercises.length - 1) setExpandedExercise(exIdx + 1);
    toast.success(`${ex.name} concluído!`);
    try { SFX.xp(); } catch { }
  };

  const allExercisesDone = exercises.every((ex) => ex.setsData.every((s) => s.done));
  const hasIncomplete = exercises.some((ex) => ex.setsData.some((s) => !s.done));
  const completedSetsCount = exercises.reduce((acc, ex) => acc + ex.setsData.filter((s) => s.done).length, 0);
  const totalSetsCount = exercises.reduce((acc, ex) => acc + ex.setsData.length, 0);

  const handleFinishWorkout = () => {
    if (hasIncomplete) {
      setShowFinishDialog(true);
    } else {
      finishWorkout();
    }
  };

  const finishWorkout = () => {
    setTimerRunning(false);
    setShowFinishDialog(false);
    setView("complete");
  };

  const cancelWorkout = () => {
    setTimerRunning(false);
    setShowCancelDialog(false);
    setShowFinishDialog(false);
    // Clear persisted state without saving
    if (selectedGroup !== null) {
      localStorage.removeItem(`workout-in-progress-${selectedGroup}`);
    }
    localStorage.removeItem("workout-execution-state");
    setView("list");
    setSelectedGroup(null);
    setExercises([]);
    setTimer(0);
    setStartedAt("");
    setEffortRating(null);
    setComment("");
    toast("Treino cancelado", { description: "Nenhum dado foi registrado." });
  };

  const handleConclude = async () => {
    if (selectedGroup === null) return;
    const groupName = workoutGroups[selectedGroup].name;
    try {
      await saveWorkout.mutateAsync({
        exercises,
        duration: timer,
        effortRating,
        comment,
        groupName,
      });

      toast.success("Treino registrado!");
      try { SFX.victory(); } catch { }
      // Calculate total volume for motivational notification
      const totalVolume = exercises.reduce((sum, ex) => 
        sum + ex.setsData.reduce((s, set) => s + ((set.weight || 0) * (set.actualReps || 0)), 0), 0);
      if (user) onWorkoutFinish(user.id, totalVolume);
      localStorage.removeItem(`workout-in-progress-${selectedGroup}`);
      localStorage.removeItem("workout-execution-state");
      // Go to share view instead of list
      setView("share" as any);
    } catch {
      toast.error("Erro ao salvar treino");
      setView("list");
      setSelectedGroup(null);
    }
    setEffortRating(null);
    setComment("");
  };

  // ═══════════════════════════════════════════════════════════
  // VIEW: HISTORY
  // ═══════════════════════════════════════════════════════════
  if (view === "history") {
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button onClick={() => setView("list")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="font-cinzel text-xl font-bold text-foreground">HISTÓRICO</h1>
        </div>

        {workoutHistory.length === 0 ? (
          <div className="text-center py-16">
            <History size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum treino registrado ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {workoutHistory.map((w) => {
              const volume = calcVolumeFromJson(w.exercises);
              const duration = w.duration_seconds ?? 0;
              const date = new Date(w.started_at);
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-cinzel text-sm font-bold text-foreground">{w.group_name || "Treino"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}
                        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {w.effort_rating && (
                      <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
                        <Flame size={12} className="text-primary" />
                        <span className="text-xs font-bold text-primary">{w.effort_rating}/10</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <Clock size={14} className="mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-[9px] text-muted-foreground">Duração</p>
                      <p className="text-xs font-bold text-foreground">{formatTime(duration)}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-2 text-center">
                      <Weight size={14} className="mx-auto mb-0.5 text-muted-foreground" />
                      <p className="text-[9px] text-muted-foreground">Volume</p>
                      <p className="text-xs font-bold text-foreground">{volume > 0 ? `${(volume / 1000).toFixed(1)}t` : "—"}</p>
                    </div>
                  </div>

                  {w.comment && (
                    <div className="mt-2 flex items-start gap-2 bg-secondary/30 rounded-lg p-2">
                      <MessageSquare size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-[11px] text-muted-foreground">{w.comment}</p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: WORKOUT GROUP LIST
  // ═══════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center justify-between pt-2 mb-1">
          <h1 className="font-cinzel text-2xl font-bold text-foreground">TREINOS</h1>
          <button
            onClick={() => setView("history")}
            className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-3 py-1.5 hover:border-primary/30 transition-colors"
          >
            <History size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Histórico</span>
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Seu plano de treinamento</p>

        {/* Plan in preparation notice */}
        {!plan && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-6 mb-4 text-center"
          >
            <AlertTriangle size={32} className="text-accent mx-auto mb-3" />
            <h2 className="font-cinzel text-base font-bold text-foreground mb-2">Plano em Preparação</h2>
            <p className="text-sm text-muted-foreground">
              Seu preparador físico está montando seu plano de treino personalizado.
              Ele aparecerá aqui assim que estiver pronto.
            </p>
          </motion.div>
        )}

        {/* Plan card - only show when specialist has assigned a plan */}
        {plan && <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="font-cinzel text-sm font-semibold text-foreground mb-4">{planTitle}</p>

          {/* Specialist analysis cards */}
          {(plan.avaliacao_postural || plan.pontos_melhoria || plan.objetivo_mesociclo) && (
            <TrainingAnalysisCards
              avaliacaoPostural={plan.avaliacao_postural}
              pontosMelhoria={plan.pontos_melhoria}
              objetivoMesociclo={plan.objetivo_mesociclo}
            />
          )}

          <div className="space-y-3">
            {workoutGroups.map((group, i) => {
              const groupSessions = workoutHistory.filter((w) => w.group_name === group.name && w.finished_at).length;
              return (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => openGroup(i)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all relative"
                >
                  {i === nextGroupIndex && (
                    <span className="absolute -top-2 right-3 text-[10px] font-cinzel font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Próximo
                    </span>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Dumbbell size={18} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.exercises.length === 0
                        ? "⏳ Aguardando exercícios..."
                        : `${group.exercises.length} exercícios · ${groupSessions} sessões`}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i === nextGroupIndex ? "crimson-gradient crimson-shadow" : "bg-secondary/80 border border-border"}`}>
                    <Play size={16} className={`ml-0.5 ${i === nextGroupIndex ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Session progress */}
          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{sessionsCompleted}/{totalSessions} sessões</span>
              {plan?.valid_until && (
                <span className="text-xs text-muted-foreground">Validade: {new Date(plan.valid_until).toLocaleDateString("pt-BR")}</span>
              )}
            </div>
            <Progress value={totalSessions > 0 ? (sessionsCompleted / totalSessions) * 100 : 0} className="h-2" />
          </div>
        </div>}

      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: EXERCISE DETAIL (pre-execution)
  // ═══════════════════════════════════════════════════════════
  if (view === "detail" && selectedGroup !== null) {
    const group = workoutGroups[selectedGroup];
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center gap-3 mb-4 pt-2">
          <button onClick={() => setView("list")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="font-cinzel text-xl font-bold text-foreground">TREINOS</h1>
        </div>

        <div className="crimson-gradient rounded-xl p-4 mb-4 flex items-center justify-between">
          <span className="font-cinzel font-bold text-primary-foreground text-sm tracking-wide">{group.name}</span>
          <div className="w-7 h-7 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center shrink-0">
            <ChevronDown size={14} className="text-primary-foreground/60" />
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {exercises.map((ex, i) => {
            const isExpanded = expandedExercise === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-secondary/50 border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : i)}
                  className="w-full flex items-center gap-3 p-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    {(ex as any).freeText ? <FileText size={16} className="text-[hsl(var(--gold))]" /> : <Dumbbell size={16} className="text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium text-foreground text-left flex-1">
                    {(ex as any).freeText ? "Instrução do Preparador" : ex.name}
                  </p>
                  <div className={`w-7 h-7 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-4 space-y-3">
                        {(ex as any).freeText ? (
                          <div className="bg-[hsl(var(--gold)/0.08)] border border-[hsl(var(--gold)/0.2)] rounded-lg p-3">
                            <p className="text-xs text-foreground whitespace-pre-line">{(ex as any).description || "Sem instruções"}</p>
                          </div>
                        ) : (
                        <>
                        {/* GIF from exercise library */}
                        {(() => {
                          const libData = exerciseLibMap.get(ex.name.toLowerCase());
                          const gifUrl = (ex as any).gif_url || libData?.gif_url;
                          return gifUrl ? (
                            <div className="rounded-lg overflow-hidden border border-border bg-background">
                              <img
                                src={gifUrl}
                                alt={`Demonstração: ${ex.name}`}
                                className="w-full max-h-48 object-contain"
                                loading="lazy"
                              />
                            </div>
                          ) : null;
                        })()}
                        <ExerciseVideoThumb videoId={ex.videoId} name={ex.name} />
                        <div className="flex items-center gap-2 bg-card rounded-lg p-3 border border-border">
                          <RefreshCw size={16} className="text-muted-foreground" />
                          <span className="text-sm text-muted-foreground flex-1">Séries:</span>
                          <span className="text-sm font-bold text-foreground">{ex.sets}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-card rounded-lg p-3 border border-border text-center">
                            <RefreshCw size={18} className="mx-auto mb-1 text-muted-foreground" />
                            <p className="text-[10px] text-muted-foreground">Repetições</p>
                            <p className="text-sm font-bold text-foreground">{ex.reps}</p>
                          </div>
                          <div className="bg-card rounded-lg p-3 border border-border text-center">
                            <Weight size={18} className="mx-auto mb-1 text-muted-foreground" />
                            <p className="text-[10px] text-muted-foreground">Carga</p>
                            <p className="text-sm font-bold text-foreground">{ex.setsData?.[0]?.weight ?? ex.weight ?? "—"}</p>
                          </div>
                          <div className="bg-card rounded-lg p-3 border border-border text-center">
                            <Clock size={18} className="mx-auto mb-1 text-muted-foreground" />
                            <p className="text-[10px] text-muted-foreground">Intervalo</p>
                            <p className="text-sm font-bold text-foreground">{ex.rest}</p>
                          </div>
                        </div>
                        {/* Exercise description/instructions from plan or library */}
                        {(() => {
                          const libData = exerciseLibMap.get(ex.name.toLowerCase());
                          const desc = (ex as any).description;
                          const instr = (ex as any).instructions || libData?.instructions;
                          return (
                            <>
                              {desc && (
                                <div className="bg-secondary/30 border border-border/50 rounded-lg p-2.5">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Objetivo da série</p>
                                  <p className="text-xs text-foreground">{desc}</p>
                                </div>
                              )}
                              {instr && (
                                <div className="bg-secondary/30 border border-border/50 rounded-lg p-2.5">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">📋 Como executar</p>
                                  <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{instr}</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                        </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={startWorkout}
          className="w-full py-4 crimson-gradient text-primary-foreground font-cinzel font-bold text-lg rounded-xl crimson-shadow tracking-wider"
        >
          Iniciar treino
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: EXECUTION
  // ═══════════════════════════════════════════════════════════
  if (view === "execution" && selectedGroup !== null) {
    const group = workoutGroups[selectedGroup];
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        {/* Rest timer overlay */}
        <AnimatePresence>
          {restTimerData && (
            <RestTimer
              seconds={restTimerData.seconds}
              onDone={() => setRestTimerData(null)}
              onSkip={() => setRestTimerData(null)}
            />
          )}
        </AnimatePresence>
        {/* Header with timer */}
        <div className="flex items-center justify-between mb-3 pt-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowFinishDialog(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={22} />
            </button>
            <div>
              <p className="font-cinzel text-sm font-bold text-foreground">EXECUÇÃO</p>
              <p className="text-[10px] text-muted-foreground">{group.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <Timer size={14} className="text-primary" />
            <span className="font-cinzel text-sm font-bold text-foreground tabular-nums">{formatTime(timer)}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">{completedSetsCount}/{totalSetsCount} séries</span>
            <span className="text-[10px] text-muted-foreground">{totalSetsCount > 0 ? Math.round((completedSetsCount / totalSetsCount) * 100) : 0}%</span>
          </div>
          <Progress value={totalSetsCount > 0 ? (completedSetsCount / totalSetsCount) * 100 : 0} className="h-2" />
        </div>

        {/* Group banner */}
        <div className="crimson-gradient rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="font-cinzel font-bold text-primary-foreground text-sm">{group.name}</span>
          <div className="w-7 h-7 rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 flex items-center justify-center shrink-0">
            <ChevronDown size={14} className="text-primary-foreground/60" />
          </div>
        </div>

        {/* Exercise cards */}
        <div className="space-y-2 mb-6">
           {exercises.map((ex, exIdx) => {
            const isExpanded = expandedExercise === exIdx;
            const isFreeText = (ex as any).freeText;
            const doneCount = ex.setsData.filter((s) => s.done).length;
            const allDone = isFreeText ? (ex as any)._freeTextDone : doneCount === ex.setsData.length;

            return (
              <motion.div
                key={exIdx}
                className={`rounded-xl border overflow-hidden transition-all ${allDone ? "bg-accent/5 border-accent/30" : "bg-secondary/50 border-border"}`}
              >
                <button
                  onClick={() => setExpandedExercise(isExpanded ? null : exIdx)}
                  className="w-full flex items-center gap-3 p-3"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${allDone ? "gold-gradient" : "bg-secondary"}`}>
                    {allDone ? <Check size={16} className="text-accent-foreground" /> : isFreeText ? <FileText size={16} className="text-[hsl(var(--gold))]" /> : <Dumbbell size={16} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${allDone ? "text-accent line-through" : "text-foreground"}`}>
                      {isFreeText ? "Instrução do Preparador" : ex.name}
                    </p>
                    {!isFreeText && <p className="text-xs text-muted-foreground">{doneCount}/{ex.setsData.length} séries</p>}
                  </div>
                  
                  {!allDone && !isFreeText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open swap drawer -> find movement pattern
                        const libData = exerciseLibMap.get(ex.name.toLowerCase());
                        setSwapData({ exIdx, oldName: ex.name, pattern: libData?.movement_pattern || null });
                      }}
                      className="w-10 h-10 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center shrink-0 hover:border-primary/50 transition-colors"
                    >
                      <RefreshCw size={14} className="text-primary" />
                    </button>
                  )}

                  <div className={`w-7 h-7 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center transition-transform duration-300 shrink-0 ${isExpanded ? "rotate-180" : ""}`}>
                    <ChevronDown size={14} className="text-muted-foreground" />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 space-y-2">
                        {isFreeText ? (
                          <>
                            <div className="bg-[hsl(var(--gold)/0.08)] border border-[hsl(var(--gold)/0.2)] rounded-lg p-3">
                              <p className="text-xs text-foreground whitespace-pre-line">{(ex as any).description || "Sem instruções"}</p>
                            </div>
                            {!(ex as any)._freeTextDone && (
                              <button
                                onClick={() => {
                                  const updated = [...exercises];
                                  updated[exIdx] = { ...updated[exIdx], _freeTextDone: true } as any;
                                  setExercises(updated);
                                  if (exIdx < exercises.length - 1) setExpandedExercise(exIdx + 1);
                                  toast.success("Instrução concluída!");
                                }}
                                className="w-full py-2 rounded-lg gold-gradient text-[hsl(var(--obsidian))] text-sm font-semibold"
                              >
                                ✅ Marcar como Feito
                              </button>
                            )}
                          </>
                        ) : (
                        <>
                        {/* Modo Foco Minimalista: Prioriza GIF, esconde estatísticas extras no topo */}
                        {(() => {
                          const libData = exerciseLibMap.get(ex.name.toLowerCase());
                          const gifUrl = (ex as any).gif_url || libData?.gif_url;
                          return gifUrl ? (
                            <div className="rounded-lg overflow-hidden border border-border bg-black/40 flex justify-center mb-4">
                              <img
                                src={gifUrl}
                                alt={`Demonstração: ${ex.name}`}
                                className="w-full max-h-56 object-contain"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="mb-4">
                              <ExerciseVideoThumb videoId={ex.videoId} name={ex.name} />
                            </div>
                          );
                        })()}
                        {/* Escondidos no Modo Foco (apenas em detail e não em execution pra ficar limpo), mas vamos manter minimal */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3 px-1">
                           <span><Clock size={12} className="inline mr-1" /> Intervalo: <strong className="text-foreground">{ex.rest}</strong></span>
                           <span>Meta: <strong className="text-foreground">{ex.reps} reps</strong></span>
                        </div>

                        {/* Set-by-set input */}
                        <div className="space-y-1.5 mt-2">
                          <div className="grid grid-cols-[1fr_3fr_3fr_2fr] gap-2 text-[9px] text-muted-foreground uppercase tracking-wider px-1">
                            <span>Série</span><span>Carga (kg)</span><span>Reps</span><span></span>
                          </div>
                          {ex.setsData.map((set, setIdx) => (
                            <div key={setIdx} className={`grid grid-cols-[1fr_3fr_3fr_2fr] gap-2 items-center p-1.5 rounded-lg ${set.done ? "bg-accent/10" : "bg-card/50"}`}>
                              <span className="text-xs font-semibold text-muted-foreground text-center">{setIdx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (set.done) {
                                    const updated = [...exercises];
                                    updated[exIdx].setsData[setIdx] = { ...set, done: false };
                                    setExercises(updated);
                                  }
                                  setSetPickerData({ exIdx, setIdx });
                                }}
                                className="h-8 rounded-md border border-border bg-background text-xs font-bold text-foreground text-center"
                              >
                                {set.weight ?? "—"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (set.done) {
                                    const updated = [...exercises];
                                    updated[exIdx].setsData[setIdx] = { ...set, done: false };
                                    setExercises(updated);
                                  }
                                  setSetPickerData({ exIdx, setIdx });
                                }}
                                className="h-8 rounded-md border border-border bg-background text-xs font-bold text-foreground text-center"
                              >
                                {set.actualReps ?? "—"}
                              </button>
                              {set.done ? (
                                <button
                                  onClick={() => {
                                    const updated = [...exercises];
                                    updated[exIdx].setsData[setIdx] = { ...set, done: false };
                                    setExercises(updated);
                                    toast("Série reaberta para edição", { icon: "✏️" });
                                  }}
                                  className="flex justify-center h-8 items-center"
                                >
                                  <Check size={14} className="text-accent" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    if (set.weight === null || set.actualReps === null) {
                                      setSetPickerData({ exIdx, setIdx });
                                    } else {
                                      confirmSet(exIdx, setIdx);
                                    }
                                  }}
                                  className="h-8 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-colors"
                                >
                                  OK
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Exercise description/instructions from specialist */}
                        {(ex as any).description && (
                          <div className="mt-2 bg-secondary/30 border border-border/50 rounded-lg p-2.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Instruções</p>
                            <p className="text-xs text-foreground">{(ex as any).description}</p>
                          </div>
                        )}

                        {!allDone && (
                          <button
                            onClick={() => completeExercise(exIdx)}
                            className="w-full py-2.5 mt-2 crimson-gradient text-primary-foreground font-cinzel text-sm font-bold rounded-lg"
                          >
                            Concluir exercício
                          </button>
                        )}
                        </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Finish workout button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleFinishWorkout}
          className={`w-full py-4 font-cinzel font-bold text-lg rounded-xl tracking-wider ${allExercisesDone
              ? "crimson-gradient text-primary-foreground crimson-shadow"
              : "bg-card border border-border text-foreground"
            }`}
        >
          Finalizar treino
        </motion.button>

        {/* Early finish alert dialog */}
        <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
          <AlertDialogContent className="bg-card border-border max-w-sm">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-destructive" />
                </div>
                <AlertDialogTitle className="font-cinzel text-foreground">Encerrar treino?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-muted-foreground">
                Você completou <span className="font-bold text-foreground">{completedSetsCount}/{totalSetsCount}</span> séries.
                Os exercícios não finalizados não serão contabilizados. Deseja encerrar assim mesmo?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogCancel className="bg-secondary text-foreground border-border">Continuar treinando</AlertDialogCancel>
              <AlertDialogAction onClick={finishWorkout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Encerrar e salvar treino
              </AlertDialogAction>
              <button
                onClick={() => { setShowFinishDialog(false); setShowCancelDialog(true); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors py-2"
              >
                Cancelar treino (não salvar)
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel workout confirmation dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent className="bg-card border-border max-w-sm">
            <AlertDialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X size={20} className="text-destructive" />
                </div>
                <AlertDialogTitle className="font-cinzel text-foreground">Cancelar treino?</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-muted-foreground">
                Todo o progresso desta sessão será descartado e <span className="font-bold text-foreground">nada será registrado</span>. Tem certeza?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-secondary text-foreground border-border">Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={cancelWorkout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Sim, cancelar treino
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Set input picker modal */}
        {setPickerData && (
          <SetInputPicker
            open={!!setPickerData}
            onClose={() => setSetPickerData(null)}
            initialReps={exercises[setPickerData.exIdx]?.setsData[setPickerData.setIdx]?.actualReps}
            initialWeight={exercises[setPickerData.exIdx]?.setsData[setPickerData.setIdx]?.weight}
            targetReps={exercises[setPickerData.exIdx]?.reps || "10"}
            onSave={(reps, weight) => {
              const updated = [...exercises];
              updated[setPickerData.exIdx].setsData[setPickerData.setIdx].actualReps = reps;
              updated[setPickerData.exIdx].setsData[setPickerData.setIdx].weight = weight;
              setExercises(updated);
              setSetPickerData(null);
            }}
          />
        )}
        
        {/* Swap Exercise Drawer */}
        <Drawer open={!!swapData} onOpenChange={(v) => !v && setSwapData(null)}>
          <DrawerContent className="bg-card border-border">
            <DrawerHeader>
              <DrawerTitle className="font-cinzel text-center text-foreground">Trocar Exercício</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 pb-12 overflow-y-auto max-h-[60vh]">
              {!swapData?.pattern ? (
                <div className="text-center text-muted-foreground py-6 flex flex-col items-center">
                  <AlertTriangle size={32} className="mb-2 text-muted-foreground/50" />
                  <p className="text-sm">Nenhuma equivalência configurada para este exercício.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-4">Selecione uma alternativa focada no mesmo padrão de movimento.</p>
                  {exerciseLibrary
                    .filter(e => e.movement_pattern === swapData.pattern && e.name !== swapData.oldName)
                    .map((sub, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (swapData) {
                            const updated = [...exercises];
                            const ex = updated[swapData.exIdx];
                            ex.name = sub.name;
                            (ex as any).gif_url = sub.gif_url;
                            (ex as any).instructions = sub.instructions;
                            // Attempt to preserve sets/reps logic but reset actuals to allow clean tracking if desired (or keep them)
                            setExercises(updated);
                            toast.success(`Substituído por ${sub.name}!`, { icon: "🔄" });
                            setSwapData(null);
                          }
                        }}
                        className="w-full text-left bg-secondary/50 hover:bg-secondary border border-border rounded-xl p-3 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-background border border-border/50 flex items-center justify-center shrink-0">
                          {sub.gif_url ? (
                            <img src={sub.gif_url} alt="" className="w-8 h-8 object-contain rounded-md" />
                          ) : (
                            <Dumbbell size={16} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{sub.name}</p>
                          <p className="text-xs text-muted-foreground">{sub.equipment || "Padrão"}</p>
                        </div>
                        <ChevronDown size={14} className="text-muted-foreground -rotate-90" />
                      </button>
                    ))}
                    {exerciseLibrary.filter(e => e.movement_pattern === swapData.pattern && e.name !== swapData.oldName).length === 0 && (
                      <p className="text-xs text-center text-muted-foreground">Nenhuma alternativa encontrada.</p>
                    )}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: COMPLETION
  // ═══════════════════════════════════════════════════════════
  if (view === "complete") {
    const volume = calcVolume(exercises);
    return (
      <div className="p-4 max-w-lg mx-auto min-h-screen flex flex-col pb-24">
        <div className="flex items-center gap-3 pt-2 mb-4">
          <button onClick={() => { setView("list"); setSelectedGroup(null); }} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="font-cinzel text-xl font-bold text-foreground">TREINOS</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-4 flex-1 flex flex-col justify-between"
        >
          <div className="text-center mb-3">
            <motion.div
              animate={{ boxShadow: ["0 0 20px hsl(var(--gold) / 0.2)", "0 0 50px hsl(var(--gold) / 0.4)", "0 0 20px hsl(var(--gold) / 0.2)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-14 h-14 mx-auto rounded-full bg-accent/10 flex items-center justify-center mb-2"
            >
              <Dumbbell size={28} className="text-accent" />
            </motion.div>
            <h2 className="font-cinzel text-xl font-bold text-foreground">Treino concluído</h2>
            {selectedGroup !== null && (
              <p className="text-xs text-muted-foreground mt-0.5">{workoutGroups[selectedGroup].name}</p>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="crimson-gradient rounded-xl p-2.5 text-center">
              <Clock size={14} className="mx-auto mb-0.5 text-primary-foreground/80" />
              <p className="text-[9px] text-primary-foreground/70">Duração</p>
              <p className="font-cinzel text-base font-bold text-primary-foreground">{formatTime(timer)}</p>
            </div>
            <div className="bg-secondary rounded-xl p-2.5 text-center">
              <Weight size={14} className="mx-auto mb-0.5 text-muted-foreground" />
              <p className="text-[9px] text-muted-foreground">Volume</p>
              <p className="font-cinzel text-base font-bold text-foreground">{volume > 0 ? `${(volume / 1000).toFixed(1)}t` : "—"}</p>
            </div>
            <div className="bg-secondary rounded-xl p-2.5 text-center relative">
              <Flame size={12} className="absolute top-1.5 right-1.5 text-accent" />
              <Check size={14} className="mx-auto mb-0.5 text-accent" />
              <p className="text-[9px] text-muted-foreground">Séries</p>
              <p className="font-cinzel text-base font-bold text-foreground">{completedSetsCount}/{totalSetsCount}</p>
            </div>
          </div>

          {/* Effort rating */}
          <div className="mb-3">
            <p className="text-xs text-foreground text-center mb-2">Percepção de esforço</p>
            <div className="flex justify-center gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setEffortRating(n)}
                  className={`w-7 h-9 rounded-lg border text-xs font-bold transition-all ${effortRating === n
                      ? "crimson-gradient text-primary-foreground border-primary crimson-shadow"
                      : "bg-secondary border-border text-foreground hover:border-primary/50"
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-0.5 px-1">
              <span className="text-[9px] text-muted-foreground">Fácil</span>
              <span className="text-[9px] text-muted-foreground">Difícil</span>
            </div>
          </div>

          {/* Comment */}
          <div className="mb-3">
            <Textarea
              placeholder="Comentário sobre o treino (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 200))}
              className="bg-secondary border-border text-foreground resize-none h-16 text-sm"
            />
            <p className="text-[9px] text-muted-foreground text-right mt-0.5">{comment.length}/200</p>
          </div>

          {/* Conclude */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConclude}
            disabled={saveWorkout.isPending}
            className="w-full py-3 crimson-gradient text-primary-foreground font-cinzel font-bold text-base rounded-xl crimson-shadow tracking-wider disabled:opacity-50"
          >
            {saveWorkout.isPending ? "Salvando..." : "Concluir"}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: SHARE
  // ═══════════════════════════════════════════════════════════
  if (view === "share") {
    const volume = calcVolume(exercises);
    const groupName = selectedGroup !== null ? workoutGroups[selectedGroup]?.name ?? "Treino" : "Treino";

    return (
      <div className="p-4 max-w-lg mx-auto min-h-[calc(100vh-80px)] flex flex-col items-center justify-center pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Card preview */}
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-border/30">
            <WorkoutShareCard
              ref={shareCardRef}
              groupName={groupName}
              duration={timer}
              volume={volume}
              completedSets={completedSetsCount}
              totalSets={totalSetsCount}
              streak={streak}
              flameState={flameState}
            />
          </div>

          {/* Share button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => shareWorkout(shareCardRef)}
            disabled={isSharing}
            className="w-full max-w-[360px] py-4 crimson-gradient text-primary-foreground font-cinzel font-bold text-base rounded-xl crimson-shadow tracking-wider disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <Share2 size={20} />
            {isSharing ? "Gerando imagem..." : "COMPARTILHAR VITÓRIA"}
          </motion.button>

          {/* Skip */}
          <button
            onClick={() => {
              setView("list");
              setSelectedGroup(null);
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default Treinos;
