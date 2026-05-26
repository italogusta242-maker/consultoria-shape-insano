import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Sparkles, X, ArrowRight } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";

export const PATCHNOTE_LIGHTMODE_KEY = "patchnote-lightmode-seen-v1";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PatchNoteLightMode = ({ open, onClose }: Props) => {
  const { setTheme } = useTheme();
  const navigate = useNavigate();

  const handleTest = () => {
    setTheme("light");
    try { localStorage.setItem(PATCHNOTE_LIGHTMODE_KEY, "1"); } catch {}
    onClose();
    navigate("/perfil");
  };

  const handleDismiss = () => {
    try { localStorage.setItem(PATCHNOTE_LIGHTMODE_KEY, "1"); } catch {}
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elevated overflow-hidden"
          >
            {/* Decorative gradient */}
            <div
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-40 blur-3xl pointer-events-none"
              style={{ background: "linear-gradient(135deg, hsl(35,100%,60%), hsl(22,95%,55%))" }}
            />

            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            {/* Badge */}
            <div className="flex items-center gap-2 mb-3 relative">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold uppercase tracking-wider">
                <Sparkles size={11} />
                Novidade
              </span>
            </div>

            {/* Theme preview */}
            <div className="flex items-center justify-center gap-3 mb-5 relative">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-soft">
                <Moon size={22} className="text-zinc-300" />
              </div>
              <ArrowRight size={18} className="text-muted-foreground" />
              <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center shadow-soft">
                <Sun size={22} className="text-[hsl(22,95%,55%)]" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-foreground tracking-tight text-center mb-2">
              Modo Claro chegou ✨
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-5 leading-relaxed">
              Agora você pode escolher entre o tema <span className="text-foreground font-medium">escuro</span> (padrão) e o novo tema <span className="text-foreground font-medium">claro</span>, com cores suaves para uso diurno.
            </p>

            {/* Where to find */}
            <div className="rounded-xl bg-secondary/40 border border-border/60 p-3 mb-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Onde alterar
              </p>
              <p className="text-sm text-foreground leading-snug">
                Vá em <span className="font-semibold text-primary">Perfil</span> e toque no botão com o ícone <Sun size={13} className="inline -mt-0.5" /> / <Moon size={13} className="inline -mt-0.5" /> para alternar.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-colors"
              >
                Depois
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleTest}
                className="flex-[1.4] py-2.5 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, hsl(22,95%,55%), hsl(35,100%,60%))",
                  boxShadow: "0 8px 20px -8px hsl(22,95%,55%,0.6)",
                }}
              >
                <Sun size={16} />
                Testar agora
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PatchNoteLightMode;
