import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Leaf, Brain, Send, ArrowLeft } from "lucide-react";

interface Mentor {
  id: string;
  name: string;
  title: string;
  icon: typeof Dumbbell;
  accent: string;
  bgAccent: string;
  borderAccent: string;
  greeting: string;
  responses: string[];
}

const mentors: Mentor[] = [
  {
    id: "mars",
    name: "MARS",
    title: "Estrategista de Treino",
    icon: Dumbbell,
    accent: "text-orange-400",
    bgAccent: "bg-orange-900/30",
    borderAccent: "border-orange-800/50",
    greeting: "Atleta! Pronto para dar tudo de si no treino? Eu sou Mars, e minha missão é forjar seu corpo com excelência.",
    responses: [
      "Sobrecarga progressiva é a lei. Cada semana, mais peso ou mais reps. Sem exceções.",
      "Treino de pernas não é opcional. Uma base fraca compromete todo o resultado.",
      "Descansa 90 segundos entre séries de força. Disciplina no descanso é disciplina no progresso.",
      "Volume é rei para hipertrofia. 10-20 séries semanais por grupo muscular. Executa!",
      "A técnica vem antes da carga. Um movimento preciso vale mais que dez descontrolados.",
    ],
  },
  {
    id: "ceres",
    name: "CERES",
    title: "Estrategista Nutricional",
    icon: Leaf,
    accent: "text-green-400",
    bgAccent: "bg-green-900/30",
    borderAccent: "border-green-800/50",
    greeting: "Bem-vindo, atleta. Sou Ceres. A nutrição é o alicerce de toda conquista. O que alimenta seu corpo, alimenta sua vitória.",
    responses: [
      "Proteína: 1.6-2.2g por kg de peso corporal. É a matéria-prima dos seus músculos.",
      "Carboidratos antes do treino. Glicogênio muscular é sua energia. Não entre no treino sem combustível.",
      "Hidratação: 35ml por kg de peso. Desidratação reduz sua performance em até 25%.",
      "Creatina: 5g por dia. É o suplemento mais estudado e eficaz. Sem mistério.",
      "Jejum intermitente pode funcionar, mas nunca sacrifique proteína. Músculos não esperam.",
    ],
  },
  {
    id: "seneca",
    name: "SENECA",
    title: "Guia Mental",
    icon: Brain,
    accent: "text-amber-400",
    bgAccent: "bg-amber-900/30",
    borderAccent: "border-amber-800/50",
    greeting: "Fala, atleta. Sou Seneca. O maior desafio não é no treino — é na sua mente. Vamos fortalecê-la juntos.",
    responses: [
      "\"Não é porque as coisas são difíceis que não ousamos. É porque não ousamos que são difíceis.\" Ousar é o primeiro passo.",
      "Respira: 4 segundos inspirando, 7 segurando, 8 expirando. Repete 4 vezes. Sua mente agradecerá.",
      "O obstáculo é o caminho. Cada dia difícil é um dia de evolução. Abraça o desconforto.",
      "Visualização: antes de dormir, veja-se completando seu treino amanhã. A mente não distingue o real do imaginado.",
      "\"Sofres mais na imaginação do que na realidade.\" Começa. O resto é momentum.",
    ],
  },
];

const Mentores = () => {
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [messages, setMessages] = useState<{ from: "user" | "mentor"; text: string }[]>([]);
  const [input, setInput] = useState("");

  const selectMentor = (mentor: Mentor) => {
    setSelectedMentor(mentor);
    setMessages([{ from: "mentor", text: mentor.greeting }]);
    setInput("");
  };

  const sendMessage = () => {
    if (!input.trim() || !selectedMentor) return;
    const userMsg = input.trim();
    setInput("");
    const randomResponse = selectedMentor.responses[Math.floor(Math.random() * selectedMentor.responses.length)];
    setMessages((prev) => [
      ...prev,
      { from: "user", text: userMsg },
      { from: "mentor", text: randomResponse },
    ]);
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="font-cinzel text-2xl font-bold text-foreground mb-1 pt-2">MENTORES</h1>
      <p className="text-muted-foreground text-sm mb-6">O Conselho dos Especialistas</p>

      {!selectedMentor ? (
        <div className="space-y-4">
          {mentors.map((mentor, i) => (
            <motion.div
              key={mentor.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => selectMentor(mentor)}
              className={`cursor-pointer bg-card rounded-xl border ${mentor.borderAccent} p-4 flex items-center gap-4 transition-all hover:gold-shadow`}
            >
              <div className={`w-14 h-14 rounded-lg ${mentor.bgAccent} flex items-center justify-center`}>
                <mentor.icon className={mentor.accent} size={28} />
              </div>
              <div>
                <h3 className={`font-cinzel font-bold ${mentor.accent}`}>{mentor.name}</h3>
                <p className="text-sm text-muted-foreground">{mentor.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col h-[calc(100vh-12rem)]"
        >
          {/* Chat header */}
          <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedMentor(null)}
              className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </motion.button>
            <div className={`w-10 h-10 rounded-lg ${selectedMentor.bgAccent} flex items-center justify-center`}>
              <selectedMentor.icon className={selectedMentor.accent} size={20} />
            </div>
            <div>
              <h3 className={`font-cinzel font-bold text-sm ${selectedMentor.accent}`}>{selectedMentor.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedMentor.title}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                    msg.from === "user"
                      ? "bg-accent/20 text-foreground"
                      : `${selectedMentor.bgAccent} ${selectedMentor.accent} border ${selectedMentor.borderAccent}`
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Fale com seu mentor..."
              className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={sendMessage}
              className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center"
            >
              <Send size={18} className="text-accent-foreground" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Mentores;
