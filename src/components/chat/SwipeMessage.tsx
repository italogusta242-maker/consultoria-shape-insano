import { useRef, useState, ReactNode } from "react";
import { Reply } from "lucide-react";

interface SwipeMessageProps {
  children: ReactNode;
  onSwipeReply: () => void;
  enabled?: boolean;
}

const THRESHOLD = 60;

const SwipeMessage = ({ children, onSwipeReply, enabled = true }: SwipeMessageProps) => {
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const swiping = useRef(false);

  if (!enabled) return <>{children}</>;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    swiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    // Only allow right swipe
    if (diff > 10) {
      swiping.current = true;
      setOffset(Math.min(diff, THRESHOLD + 20));
    }
  };

  const handleTouchEnd = () => {
    if (offset >= THRESHOLD) {
      onSwipeReply();
    }
    setOffset(0);
    swiping.current = false;
  };

  return (
    <div className="relative overflow-hidden">
      {/* Reply icon behind */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 transition-opacity"
        style={{ opacity: Math.min(offset / THRESHOLD, 1) }}
      >
        <Reply size={18} className="text-accent" />
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeMessage;
