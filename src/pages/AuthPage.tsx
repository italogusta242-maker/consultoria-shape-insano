import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import InsanoLogo from "@/components/InsanoLogo";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import authBg from "@/assets/auth-bg.webp";

const AuthPage = () => {
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error(error === "Invalid login credentials" ? "Email ou senha incorretos" : error);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-end overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <img src={authBg} alt="" fetchPriority="high" loading="eager" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="relative z-10 w-full max-w-md px-6 pb-12 pt-20 flex flex-col items-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }} className="mb-6">
          <InsanoLogo size={88} className="mx-auto" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.25 }} className="font-cinzel text-4xl md:text-5xl font-bold text-foreground text-center tracking-wide mb-2">
          <span className="gold-text-gradient">SHAPE INSANO</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.2 }} className="font-cinzel text-sm text-muted-foreground tracking-[0.3em] uppercase mb-2 text-center">
          Ser Insano é Ser Um Vencedor
        </motion.p>
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-accent to-transparent mb-6" />

        <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.25 }} onSubmit={handleLogin} className="w-full space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 py-6 bg-card/80 border-border text-foreground rounded-xl" required autoComplete="email" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input type={showPassword ? "text" : "password"} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 py-6 bg-card/80 border-border text-foreground rounded-xl" required autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading} className="w-full py-4 crimson-gradient text-foreground font-cinzel font-bold rounded-xl crimson-shadow tracking-wider text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={18} className="animate-spin" /> ENTRANDO...</> : "ENTRAR"}
          </motion.button>
        </motion.form>

        <p className="text-muted-foreground/50 text-xs text-center mt-6 font-cinzel tracking-wider">
          "Grandes resultados exigem consistência.<br />Sua transformação começa agora."
        </p>
      </motion.div>
    </div>
  );
};

export default AuthPage;
