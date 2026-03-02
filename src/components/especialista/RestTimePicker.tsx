import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ScrollWheelPicker from "@/components/ui/ScrollWheelPicker";
import { Clock } from "lucide-react";

const MINUTES = Array.from({ length: 6 }, (_, i) => i); // 0-5
const SECONDS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...55

/** Parse rest string like "1'30\"" into {min, sec} */
function parseRest(rest: string): { min: number; sec: number } {
  if (!rest) return { min: 1, sec: 30 };
  const match = rest.match(/(\d+)'(?:\s*(\d+)"?)?/);
  if (!match) return { min: 1, sec: 30 };
  return { min: parseInt(match[1]) || 0, sec: parseInt(match[2]) || 0 };
}

function formatRest(min: number, sec: number): string {
  if (sec === 0) return `${min}'`;
  return `${min}'${sec.toString().padStart(2, "0")}"`;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function RestTimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const parsed = parseRest(value);
  const [min, setMin] = useState(parsed.min);
  const [sec, setSec] = useState(parsed.sec);

  const handleOpen = () => {
    const p = parseRest(value);
    setMin(p.min);
    setSec(p.sec);
    setOpen(true);
  };

  const handleSave = () => {
    onChange(formatRest(min, sec));
    setOpen(false);
  };

  const secIdx = SECONDS.indexOf(sec);
  const roundedSecIdx = secIdx >= 0 ? secIdx : 0;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="h-7 w-full flex items-center justify-center gap-1 text-xs bg-[hsl(var(--glass-bg))] border border-[hsl(var(--glass-border))] rounded-md hover:border-primary/40 transition-colors"
      >
        <Clock size={10} className="text-muted-foreground" />
        <span className="text-foreground font-medium">{value || "1'30\""}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[320px] p-0 bg-background border-border overflow-hidden">
          <div className="p-4 pb-2 text-center">
            <p className="font-cinzel text-sm font-bold text-foreground">Tempo de Descanso</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRest(min, sec)}
            </p>
          </div>

          <ScrollWheelPicker
            className="px-4"
            columns={[
              { values: MINUTES, selected: min, label: "MIN" },
              { values: SECONDS.map(s => s.toString().padStart(2, "0")), selected: roundedSecIdx, label: "SEG" },
            ]}
            onChangeColumn={(colIdx, valueIdx) => {
              if (colIdx === 0) setMin(MINUTES[valueIdx]);
              else setSec(SECONDS[valueIdx]);
            }}
          />

          <div className="p-4 pt-2">
            <Button
              onClick={handleSave}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl"
            >
              SALVAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
