/**
 * @purpose Preview modal showing how the student will see their training plan.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo } from "react";
import { Dumbbell, ChevronDown, Timer, MessageSquare, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExerciseItem {
  name: string;
  sets: number;
  reps: string;
  weight?: number | null;
  rest: string;
  videoId?: string | null;
  description?: string;
  freeText?: boolean;
}

interface Group {
  name: string;
  exercises: ExerciseItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  studentName: string;
  title: string;
  gifMap: Map<string, string>;
}

export default function TrainingPreviewModal({ open, onClose, groups, studentName, title, gifMap }: Props) {
  const [expandedGroup, setExpandedGroup] = useState<number | null>(0);

  const totalExercises = useMemo(() => groups.reduce((acc, g) => acc + g.exercises.length, 0), [groups]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] p-0 bg-background border-border overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Dumbbell size={16} className="text-[hsl(var(--forja-teal))]" />
            <span className="font-cinzel">PREVIEW: Visão do Aluno</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {studentName ? `Como ${studentName} verá` : "Como o aluno verá"} — "{title}"
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-80px)]">
          <div className="p-4 space-y-3">
            {/* Summary */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Resumo do Plano</p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="font-cinzel text-lg font-bold text-accent">{groups.length}</p>
                  <p className="text-[10px] text-muted-foreground">Treinos</p>
                </div>
                <div>
                  <p className="font-cinzel text-lg font-bold text-foreground">{totalExercises}</p>
                  <p className="text-[10px] text-muted-foreground">Exercícios</p>
                </div>
              </div>
            </div>

            {/* Groups */}
            {groups.map((group, gi) => {
              const isExpanded = expandedGroup === gi;
              return (
                <div key={gi} className="rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : gi)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-secondary border border-border">
                      <Dumbbell size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-cinzel text-sm font-bold truncate text-foreground">{group.name}</p>
                      <p className="text-[10px] text-muted-foreground">{group.exercises.length} exercícios</p>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                      <ChevronDown size={18} className="text-muted-foreground" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {group.exercises.map((ex, ei) => {
                            const gifUrl = gifMap.get(ex.name.toLowerCase());
                            return (
                              <div key={ei} className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                                {ex.freeText ? (
                                  <div className="flex gap-2">
                                    <FileText size={16} className="text-[hsl(var(--gold))] shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-foreground mb-1">Instrução do Preparador</p>
                                      <p className="text-xs text-muted-foreground whitespace-pre-line">{ex.description || "Sem instruções"}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex gap-3">
                                      {gifUrl && (
                                        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-border">
                                          <img src={gifUrl} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground">{ex.name}</p>
                                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                                          <span>{ex.sets} séries × {ex.reps}</span>
                                          {ex.weight && <span>· {ex.weight}kg</span>}
                                          {ex.rest && (
                                            <span className="flex items-center gap-0.5">
                                              <Timer size={10} /> {ex.rest}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {ex.description && (
                                      <div className="mt-2 rounded-lg bg-accent/5 border border-accent/20 p-2 flex gap-2">
                                        <MessageSquare size={12} className="text-accent shrink-0 mt-0.5" />
                                        <p className="text-xs text-muted-foreground">{ex.description}</p>
                                      </div>
                                    )}
                                   </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
