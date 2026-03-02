import { Shield, Dumbbell, Leaf } from "lucide-react";
import { motion } from "framer-motion";

interface SystemMessageProps {
  content: string;
}

const getIcon = (content: string) => {
  const lower = content.toLowerCase();
  if (lower.includes("treino") || lower.includes("training")) return Dumbbell;
  if (lower.includes("dieta") || lower.includes("diet")) return Leaf;
  return Shield;
};

const SystemMessage = ({ content }: SystemMessageProps) => {
  const Icon = getIcon(content);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex justify-center my-3"
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 max-w-[85%]">
        <Icon size={14} className="text-accent shrink-0" />
        <p className="text-[11px] text-accent font-medium">{content}</p>
      </div>
    </motion.div>
  );
};

export default SystemMessage;
