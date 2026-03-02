import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollWheelColumn {
  values: (string | number)[];
  selected: number; // index
  label?: string;
  width?: string;
}

interface ScrollWheelPickerProps {
  columns: ScrollWheelColumn[];
  onChangeColumn: (colIdx: number, valueIdx: number) => void;
  itemHeight?: number;
  visibleItems?: number;
  className?: string;
}

const ITEM_H = 44;
const VISIBLE = 5;

function WheelColumn({
  values,
  selected,
  label,
  width,
  onChange,
}: {
  values: (string | number)[];
  selected: number;
  label?: string;
  width?: string;
  onChange: (idx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const momentum = useRef(0);
  const animFrame = useRef<number>();
  const [isScrolling, setIsScrolling] = useState(false);

  const halfVisible = Math.floor(VISIBLE / 2);
  const totalHeight = VISIBLE * ITEM_H;

  // Scroll to selected on mount and when selected changes externally
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const targetScroll = selected * ITEM_H;
    el.scrollTop = targetScroll;
  }, [selected]);

  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(values.length - 1, idx));
    el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    if (clamped !== selected) {
      onChange(clamped);
    }
    setIsScrolling(false);
  }, [values.length, selected, onChange]);

  // Use a stable timeout ref for debounced snapping
  const snapTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleScroll = useCallback(() => {
    if (isDragging.current) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      snapToNearest();
    }, 120);
  }, [snapToNearest]);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startScroll.current = containerRef.current?.scrollTop ?? 0;
    setIsScrolling(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const dy = startY.current - e.touches[0].clientY;
    containerRef.current.scrollTop = startScroll.current + dy;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    snapToNearest();
  };

  // Click on item to select it
  const handleItemClick = (idx: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    onChange(idx);
  };

  return (
    <div className={cn("relative", width || "flex-1")} style={{ height: totalHeight }}>
      {/* Selection highlight */}
      <div
        className="absolute left-0 right-0 bg-secondary/80 rounded-xl pointer-events-none z-10 border border-border/50"
        style={{ top: halfVisible * ITEM_H, height: ITEM_H }}
      />

      {/* Label on the highlight */}
      {label && (
        <span
          className="absolute right-3 z-20 pointer-events-none text-xs font-bold uppercase tracking-wider text-muted-foreground"
          style={{ top: halfVisible * ITEM_H + ITEM_H / 2, transform: "translateY(-50%)" }}
        >
          {label}
        </span>
      )}

      {/* Fade gradients */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background to-transparent z-20 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto scrollbar-hide"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top padding */}
        <div style={{ height: halfVisible * ITEM_H }} />

        {values.map((val, idx) => {
          const distance = Math.abs(idx - selected);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.5 : distance === 2 ? 0.3 : 0.15;
          const scale = distance === 0 ? 1 : distance === 1 ? 0.85 : 0.75;

          return (
            <div
              key={idx}
              className="flex items-center justify-center cursor-pointer select-none"
              style={{
                height: ITEM_H,
                opacity,
                transform: `scale(${scale})`,
                transition: "opacity 0.15s, transform 0.15s",
              }}
              onClick={() => handleItemClick(idx)}
            >
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {val}
              </span>
            </div>
          );
        })}

        {/* Bottom padding */}
        <div style={{ height: halfVisible * ITEM_H }} />
      </div>
    </div>
  );
}

export default function ScrollWheelPicker({
  columns,
  onChangeColumn,
  className,
}: ScrollWheelPickerProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {columns.map((col, idx) => (
        <WheelColumn
          key={idx}
          values={col.values}
          selected={col.selected}
          label={col.label}
          width={col.width}
          onChange={(valueIdx) => onChangeColumn(idx, valueIdx)}
        />
      ))}
    </div>
  );
}
