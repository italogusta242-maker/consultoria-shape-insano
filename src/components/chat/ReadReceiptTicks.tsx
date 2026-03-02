import { Check, CheckCheck } from "lucide-react";

interface ReadReceiptTicksProps {
  isRead: boolean;
  isMine: boolean;
}

const ReadReceiptTicks = ({ isRead, isMine }: ReadReceiptTicksProps) => {
  if (!isMine) return null;

  return isRead ? (
    <CheckCheck size={14} className="text-accent inline-block ml-1" />
  ) : (
    <Check size={14} className="text-muted-foreground inline-block ml-1" />
  );
};

export default ReadReceiptTicks;
