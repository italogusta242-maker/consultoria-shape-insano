import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiDetailItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "warning" | "danger" | "success";
  actionLabel?: string;
  onAction?: () => void;
}

interface KpiDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  items: KpiDetailItem[];
  emptyMessage?: string;
}

const badgeColors: Record<string, string> = {
  default: "bg-secondary text-foreground",
  warning: "bg-amber-500/20 text-amber-400",
  danger: "bg-destructive/20 text-destructive",
  success: "bg-emerald-500/20 text-emerald-400",
};

export const KpiDetailModal = ({
  open,
  onOpenChange,
  title,
  description,
  items,
  emptyMessage = "Nenhum item encontrado.",
}: KpiDetailModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-cinzel text-foreground">{title}</DialogTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] mt-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.badge && (
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        badgeColors[item.badgeVariant || "default"]
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {item.actionLabel && item.onAction && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-primary hover:text-primary"
                        onClick={item.onAction}
                      >
                        {item.actionLabel}
                        <ExternalLink size={10} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
