import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import mockupHome from "@/assets/slide-home.png";
import mockupTreino from "@/assets/mockup-treino.png";
import mockupDieta from "@/assets/mockup-dieta.png";
import mockupChat from "@/assets/mockup-chat.png";
import mockupProgresso from "@/assets/mockup-progresso.png";
import mockupPerfil from "@/assets/mockup-perfil.png";

const slides = [
  {
    id: 1,
    title: "Tela Inicial",
    subtitle: "Tudo que o aluno precisa em um só lugar",
    description: "Dashboard completo com score de saúde, estado mental, gráfico de performance semanal, volume de treino por região e botão de iniciar treino.",
    image: mockupHome,
    accent: "from-amber-500/30 to-orange-600/20",
  },
  {
    id: 2,
    title: "Metas Diárias",
    subtitle: "Controle total do dia a dia",
    description: "Acompanhamento de volume semanal por grupo muscular, metas de refeições, sono e hidratação com controle em tempo real. Frases motivacionais diárias.",
    image: mockupProgresso,
    accent: "from-purple-500/30 to-violet-600/20",
  },
  {
    id: 3,
    title: "Treinos Personalizados",
    subtitle: "Planos montados pelo Preparador Físico",
    description: "Cada exercício com vídeo demonstrativo, séries, repetições, carga e intervalo. O aluno executa o treino de forma guiada e registra cada série.",
    image: mockupTreino,
    accent: "from-red-500/30 to-orange-600/20",
  },
  {
    id: 4,
    title: "Plano Alimentar",
    subtitle: "Dieta sob medida pelo Nutricionista",
    description: "Macros do dia (calorias, proteína, carbs, gordura), checklist de refeições com horários e detalhes nutricionais de cada refeição.",
    image: mockupDieta,
    accent: "from-green-500/30 to-emerald-600/20",
  },
  {
    id: 5,
    title: "Chat com Especialistas",
    subtitle: "Comunicação direta em tempo real",
    description: "Mensagens diretas com o Preparador Físico e Nutricionista. Tire dúvidas, envie fotos e receba feedback instantâneo a qualquer momento.",
    image: mockupChat,
    accent: "from-blue-500/30 to-cyan-600/20",
  },
  {
    id: 6,
    title: "Perfil do Aluno",
    subtitle: "Dados e evolução sempre à mão",
    description: "Peso, altura, idade, IMC e BF%. Acesso rápido a medidas, fotos de evolução, notificações e gerenciamento de assinatura.",
    image: mockupPerfil,
    accent: "from-orange-500/30 to-amber-600/20",
  },
];

const CloserApresentacao = () => {
  const [current, setCurrent] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const prev = () => setCurrent((c) => (c > 0 ? c - 1 : slides.length - 1));
  const next = () => setCurrent((c) => (c < slides.length - 1 ? c + 1 : 0));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const slide = slides[current];

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden select-none",
        fullscreen ? "fixed inset-0 z-[9999] bg-black" : "min-h-[calc(100vh-96px)] rounded-xl"
      )}
    >
      {/* Background gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-40", slide.accent)} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--background))_100%)]" />

      {/* Controls top */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          {current + 1} / {slides.length}
        </span>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-muted-foreground hover:text-foreground">
          {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </Button>
      </div>

      {/* Slide content */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 h-full min-h-[calc(100vh-96px)] px-6 py-12">
        {/* Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id + "-text"}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.4 }}
            className="flex-1 max-w-md text-center lg:text-left"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2 font-cinzel">
              Funcionalidade {slide.id}
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold font-cinzel gold-text-gradient mb-3">
              {slide.title}
            </h2>
            <p className="text-lg text-foreground/80 font-medium mb-4">
              {slide.subtitle}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {slide.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Phone mockup */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id + "-img"}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ duration: 0.45 }}
            className="flex-shrink-0"
          >
            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-to-b from-gold/20 to-transparent rounded-full blur-3xl opacity-50" />
              <img
                src={slide.image}
                alt={slide.title}
                className="relative w-[260px] lg:w-[300px] rounded-[2rem] shadow-2xl shadow-black/60 border border-white/10"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-foreground transition-colors"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 text-foreground transition-colors"
      >
        <ChevronRight size={24} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all duration-300",
              i === current ? "bg-gold w-8" : "bg-white/20 hover:bg-white/40"
            )}
          />
        ))}
      </div>
    </div>
  );
};

export default CloserApresentacao;
