import { useState } from "react";
import { format, addDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SuspendAlertPayload {
  reason: string;
  expiresAt: Date | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName?: string;
  alertTitle?: string;
  isSubmitting?: boolean;
  onConfirm: (payload: SuspendAlertPayload) => void;
}

const REASONS = [
  { value: "no_response", label: "Sem resposta do aluno" },
  { value: "will_respond_later", label: "Aluno vai responder depois" },
  { value: "other", label: "Outros" },
];

const DURATIONS = [
  { value: "indef", label: "Tempo indeterminado" },
  { value: "3d", label: "Em 3 dias" },
  { value: "7d", label: "Em 7 dias" },
  { value: "custom", label: "Data específica" },
];

export function SuspendAlertModal({
  open,
  onOpenChange,
  studentName,
  alertTitle,
  isSubmitting,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState<string>("no_response");
  const [duration, setDuration] = useState<string>("indef");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  const computeExpiresAt = (): Date | null => {
    switch (duration) {
      case "3d":
        return addDays(new Date(), 3);
      case "7d":
        return addDays(new Date(), 7);
      case "custom":
        return customDate ?? null;
      case "indef":
      default:
        return null;
    }
  };

  const handleConfirm = () => {
    const reasonLabel = REASONS.find((r) => r.value === reason)?.label ?? reason;
    onConfirm({ reason: reasonLabel, expiresAt: computeExpiresAt() });
  };

  const canConfirm = duration !== "custom" || !!customDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cinzel">Suspender Aviso</DialogTitle>
          <DialogDescription>
            {studentName && alertTitle
              ? `${alertTitle} · ${studentName}`
              : "Move este alerta para a lista 'Aguardando Aluno'."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Motivo
            </p>
            <RadioGroup value={reason} onValueChange={setReason} className="space-y-1">
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
                  <Label htmlFor={`reason-${r.value}`} className="text-sm font-normal cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prazo
            </p>
            <RadioGroup value={duration} onValueChange={setDuration} className="space-y-1">
              {DURATIONS.map((d) => (
                <div key={d.value} className="flex items-center gap-2">
                  <RadioGroupItem value={d.value} id={`dur-${d.value}`} />
                  <Label htmlFor={`dur-${d.value}`} className="text-sm font-normal cursor-pointer">
                    {d.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {duration === "custom" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-2",
                      !customDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customDate ? format(customDate, "dd/MM/yyyy") : "Escolher data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customDate}
                    onSelect={setCustomDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || isSubmitting}>
            Suspender
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
