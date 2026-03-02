import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, Zap, Brain, X, Clock } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export type MentalState = "focado" | "neutro" | "cansado" | "desanimado" | "energizado";

export interface CheckInResult {
  mentalState: MentalState;
  sleepDuration: number;
}

interface DailyCheckInProps {
  open: boolean;
  onComplete: (result: CheckInResult) => void;
  onClose: () => void;
}

interface Question {
  id: string;
  icon: typeof Moon;
  question: string;
  options: { label: string; emoji: string; value: number }[];
}

const questions: Question[] = [
  {
    id: "sleep",
    icon: Moon,
    question: "Como você dormiu?",
    options: [
      { label: "Ruim", emoji: "😫", value: 1 },
      { label: "Ok", emoji: "😐", value: 2 },
      { label: "Bem", emoji: "😊", value: 3 },
      { label: "Ótimo", emoji: "😴", value: 4 },
    ],
  },
  {
    id: "energy",
    icon: Zap,
    question: "Como está sua energia hoje?",
    options: [
      { label: "Baixa", emoji: "🔋", value: 1 },
      { label: "Média", emoji: "⚡", value: 2 },
      { label: "Alta", emoji: "🔥", value: 3 },
    ],
  },
  {
    id: "stress",
    icon: Brain,
    question: "Nível de estresse?",
    options: [
      { label: "Alto", emoji: "😰", value: 3 },
      { label: "Médio", emoji: "😤", value: 2 },
      { label: "Baixo", emoji: "😌", value: 1 },
    ],
  },
];

// Total steps = questions + sleep duration step + result
const SLEEP_STEP = questions.length;

function calculateMentalState(answers: Record<string, number>, streak: number): MentalState {
  const sleep = answers.sleep ?? 2;
  const energy = answers.energy ?? 2;
  const stress = answers.stress ?? 2;

  const score = sleep + energy - stress + (streak >= 3 ? 1 : 0);

  if (score >= 6) return "energizado";
  if (score >= 4) return "focado";
  if (score >= 3) return "neutro";
  if (score >= 2) return "cansado";
  return "desanimado";
}

const mentalStateLabels: Record<MentalState, { label: string; emoji: string }> = {
  energizado: { label: "Energizado", emoji: "⚡" },
  focado: { label: "Focado", emoji: "🎯" },
  neutro: { label: "Neutro", emoji: "😐" },
  cansado: { label: "Cansado", emoji: "😪" },
  desanimado: { label: "Desanimado", emoji: "😔" },
};

export { mentalStateLabels, calculateMentalState };

const sleepLabels: Record<number, string> = {
  3: "−3h 😵",
  4: "4h 😫",
  5: "5h 😪",
  6: "6h 😐",
  7: "7h 😊",
  8: "8h 😴",
  9: "9h 🛌",
  10: "+10h 💤",
};

const DailyCheckIn = ({ open, onComplete, onClose }: DailyCheckInProps) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<MentalState | null>(null);
  const [sleepDuration, setSleepDuration] = useState(7);

  if (!open) return null;

  const totalSteps = questions.length + 1; // questions + sleep duration

  const handleAnswer = (questionId: string, value: number) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    // Move to next step (next question or sleep step)
    setTimeout(() => setStep(step + 1), 300);
  };

  const handleSleepConfirm = () => {
    const state = calculateMentalState(answers, 5);
    setResult(state);
    setTimeout(() => onComplete({ mentalState: state, sleepDuration }), 1500);
  };

  const isQuestionStep = step < questions.length;
  const isSleepStep = step === SLEEP_STEP;
  const current = isQuestionStep ? questions[step] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Check-in Diário</p>
          <div className="flex justify-center gap-1 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === step ? 24 : 12,
                  background: i <= step ? "hsl(var(--accent))" : "hsl(var(--secondary))",
                }}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-4"
            >
              <p className="text-4xl mb-3">{mentalStateLabels[result].emoji}</p>
              <p className="font-cinzel text-lg font-bold text-foreground">{mentalStateLabels[result].label}</p>
              <p className="text-xs text-muted-foreground mt-1">Estado mental registrado</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sono: {sleepDuration}h</p>
            </motion.div>
          ) : isSleepStep ? (
            <motion.div
              key="sleep-duration"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <Clock size={28} className="mx-auto mb-3 text-accent" />
              <h3 className="font-cinzel text-base font-bold text-foreground mb-2">Quantas horas dormiu?</h3>
              <p className="text-3xl font-bold text-foreground mb-1">
                {sleepDuration <= 3 ? "−3h" : sleepDuration >= 10 ? "+10h" : `${sleepDuration}h`}
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                {sleepLabels[sleepDuration] ?? `${sleepDuration}h`}
              </p>
              <div className="px-4 mb-6">
                <Slider
                  value={[sleepDuration]}
                  onValueChange={(v) => setSleepDuration(v[0])}
                  min={3}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>−3h</span>
                  <span>+10h</span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleSleepConfirm}
                className="px-8 py-2.5 rounded-xl font-cinzel text-sm font-bold text-foreground transition-colors"
                style={{ background: "hsl(var(--accent) / 0.2)", border: "1px solid hsl(var(--accent) / 0.4)" }}
              >
                CONFIRMAR
              </motion.button>
            </motion.div>
          ) : current ? (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-center"
            >
              <current.icon size={28} className="mx-auto mb-3 text-accent" />
              <h3 className="font-cinzel text-base font-bold text-foreground mb-6">{current.question}</h3>
              <div className="flex gap-2 justify-center">
                {current.options.map((opt) => (
                  <motion.button
                    key={opt.label}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnswer(current.id, opt.value)}
                    className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-colors ${
                      answers[current.id] === opt.value
                        ? "bg-accent/20 border-accent/50"
                        : "bg-secondary border-border hover:border-accent/30"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-[10px] text-muted-foreground">{opt.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DailyCheckIn;
