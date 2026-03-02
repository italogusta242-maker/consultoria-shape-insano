import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Dumbbell, UtensilsCrossed, Droplets, Moon, ChevronLeft, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { DayPerformance } from "@/hooks/useRealPerformance";

interface PerformanceDetailModalProps {
  open: boolean;
  onClose: () => void;
  weekData: DayPerformance[];
  monthData: DayPerformance[];
}

const ScoreBar = ({ label, icon: Icon, value, max, color }: {
  label: string; icon: any; value: number; max: number; color: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
      <Icon size={14} style={{ color }} />
    </div>
    <div className="flex-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
    </div>
  </div>
);

const PerformanceDetailModal = ({ open, onClose, weekData, monthData }: PerformanceDetailModalProps) => {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState<DayPerformance | null>(null);

  if (!open) return null;

  const data = period === "week" ? weekData : monthData;
  const avgScore = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length) : 0;
  const maxScore = data.length > 0 ? Math.max(...data.map(d => d.score)) : 0;
  const daysWithTraining = data.filter(d => d.training > 0).length;

  const handleDotClick = (dayLabel: string) => {
    const day = data.find(d => d.day === dayLabel);
    if (day) setSelectedDay(selectedDay?.date === day.date ? null : day);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="font-cinzel text-base font-bold text-foreground">Evolução de Performance</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Period toggle */}
          <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
            {(["week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setSelectedDay(null); }}
                className={`flex-1 py-2 rounded-md text-xs font-cinzel font-semibold transition-all ${
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "week" ? "7 Dias" : "30 Dias"}
              </button>
            ))}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-foreground">{avgScore}</p>
              <p className="text-[10px] text-muted-foreground">Média</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-accent">{maxScore}</p>
              <p className="text-[10px] text-muted-foreground">Máximo</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary">{daysWithTraining}</p>
              <p className="text-[10px] text-muted-foreground">Dias treino</p>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-secondary/20 rounded-xl border border-border p-3">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} onClick={(e: any) => {
                  if (e?.activeLabel) handleDotClick(e.activeLabel);
                }}>
                  <defs>
                    <linearGradient id="perfGradModal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25, 100%, 50%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(25, 100%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: period === "month" ? 8 : 10, fill: "hsl(43, 10%, 55%)" }}
                    axisLine={false}
                    tickLine={false}
                    interval={period === "month" ? 4 : 0}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(43, 10%, 55%)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(0, 0%, 10%)", border: "1px solid hsl(0, 0%, 16%)",
                      borderRadius: "8px", fontSize: "12px", color: "hsl(43, 30%, 85%)",
                    }}
                    formatter={(value: number) => [`${value} pts`, "Score"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(25, 100%, 50%)"
                    fill="url(#perfGradModal)"
                    strokeWidth={2}
                    dot={{ fill: "hsl(25, 100%, 55%)", r: period === "month" ? 2 : 3, cursor: "pointer" }}
                    activeDot={{ r: 5, fill: "hsl(var(--accent))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Toque em um ponto para ver o detalhamento do dia
            </p>
          </div>

          {/* Selected day breakdown */}
          <AnimatePresence>
            {selectedDay && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-secondary/20 rounded-xl border border-accent/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-cinzel text-sm font-bold text-foreground">
                      {selectedDay.day} — {selectedDay.date}
                    </h3>
                    <span className="text-lg font-bold text-accent">{selectedDay.score}/100</span>
                  </div>

                  <ScoreBar
                    label={selectedDay.groupName ? `Treino (${selectedDay.groupName})` : "Treino"}
                    icon={Dumbbell}
                    value={selectedDay.training}
                    max={40}
                    color="hsl(25, 100%, 50%)"
                  />

                  <ScoreBar
                    label="Alimentação"
                    icon={UtensilsCrossed}
                    value={selectedDay.diet}
                    max={40}
                    color="hsl(140, 60%, 40%)"
                  />

                  <ScoreBar
                    label={`Água${selectedDay.waterLiters ? ` (${selectedDay.waterLiters}L)` : ""}`}
                    icon={Droplets}
                    value={selectedDay.water}
                    max={10}
                    color="hsl(200, 70%, 50%)"
                  />

                  <ScoreBar
                    label={`Sono${selectedDay.sleepHours ? ` (${selectedDay.sleepHours}h)` : ""}`}
                    icon={Moon}
                    value={selectedDay.sleep}
                    max={10}
                    color="hsl(260, 60%, 55%)"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Daily list */}
          <div>
            <h3 className="font-cinzel text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Resumo por dia
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {[...data].reverse().map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(selectedDay?.date === day.date ? null : day)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all text-left ${
                    selectedDay?.date === day.date
                      ? "bg-accent/10 border border-accent/30"
                      : "bg-secondary/20 hover:bg-secondary/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground w-12">{day.day}</span>
                    <div className="flex gap-1">
                      {day.training > 0 && <Dumbbell size={12} className="text-primary" />}
                      {day.diet > 0 && <UtensilsCrossed size={12} className="text-green-500" />}
                      {day.water > 0 && <Droplets size={12} className="text-blue-400" />}
                      {day.sleep > 0 && <Moon size={12} className="text-purple-400" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${day.score}%`,
                          background: day.score >= 70 ? "hsl(140, 60%, 40%)" : day.score >= 40 ? "hsl(40, 80%, 50%)" : "hsl(0, 70%, 45%)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground w-8 text-right">{day.score}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PerformanceDetailModal;