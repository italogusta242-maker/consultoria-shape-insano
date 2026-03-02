import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ScrollWheelPicker from "@/components/ui/ScrollWheelPicker";

const REPS = Array.from({ length: 50 }, (_, i) => i + 1); // 1-50

interface Props {
  open: boolean;
  onClose: () => void;
  initialReps: number | null;
  initialWeight: number | null;
  targetReps: string;
  onSave: (reps: number, weight: number) => void;
}

export default function SetInputPicker({ open, onClose, initialReps, initialWeight, targetReps, onSave }: Props) {
  const defaultReps = initialReps ?? (parseInt(targetReps) || 10);

  const [repsIdx, setRepsIdx] = useState(Math.max(0, defaultReps - 1));
  const [weightText, setWeightText] = useState(
    initialWeight !== null ? String(initialWeight) : "20"
  );

  const handleSave = () => {
    const reps = REPS[repsIdx];
    const weight = parseFloat(weightText) || 0;
    onSave(reps, weight);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[360px] p-0 bg-background border-border overflow-hidden">
        <div className="p-4 pb-2 text-center">
          <p className="font-cinzel text-sm font-bold text-foreground">Registrar Série</p>
          <p className="text-xs text-muted-foreground mt-0.5">Alvo: {targetReps} reps</p>
        </div>

        <div className="flex gap-6 px-4 items-center">
          {/* Reps wheel */}
          <div className="flex-1">
            <ScrollWheelPicker
              columns={[
                { values: REPS, selected: repsIdx, label: "REPS" },
              ]}
              onChangeColumn={(_, valueIdx) => setRepsIdx(valueIdx)}
            />
          </div>

          {/* Weight text input */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-bold">Carga (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              max="500"
              value={weightText}
              onChange={(e) => setWeightText(e.target.value)}
              className="w-24 h-12 text-center text-2xl font-bold bg-secondary/80 border border-border/50 rounded-xl text-foreground outline-none focus:border-[hsl(var(--gold))] transition-colors tabular-nums"
            />
          </div>
        </div>

        <div className="p-4 pt-2">
          <Button
            onClick={handleSave}
            className="w-full py-4 rounded-2xl font-bold text-lg text-background border-0"
            style={{ background: "linear-gradient(135deg, hsl(40, 100%, 55%), hsl(25, 100%, 50%))" }}
          >
            SALVAR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
