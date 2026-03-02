/**
 * Motivational notification messages (Estilo Duolingo / Loss Aversion)
 * 
 * Each pool has multiple phrases for variety.
 * {streak}, {volume}, {name} are template vars.
 */

// ══════════════════════════════════════════════════════════
// "Olho do Dono" - Igor (Personal Trainer) - 10% chance on workout start
// ══════════════════════════════════════════════════════════
export const COACH_WATCHING_START = [
  "Tô vendo que começou o treino agora, hein? 👀 Foco total, não descansa mais do que o necessário!",
  "O sistema me avisou que você iniciou. Hoje é dia de moer! Sem desculpas. 💪",
  "Bora! Vi que chegou pra treinar. Cada série conta, cada rep importa. 🏋️",
  "Opa, começou! Lembra: treino sem foco é só passeio. Mete bronca! 👊",
  "Olha só quem apareceu pra treinar! 👀 Faz valer cada minuto.",
];

// ══════════════════════════════════════════════════════════
// "Olho do Dono" - Nutri - 10% chance on diet 100%
// ══════════════════════════════════════════════════════════
export const NUTRI_WATCHING_DIET = [
  "Refeição batida! Tô acompanhando aqui e a constância está ficando animal. 🍎",
  "Bateu a meta da dieta? É isso que traz o resultado. O shape tá vindo! 👀",
  "Dieta 100% batida! O shape é consequência da sua disciplina hoje. 👏",
  "Todas as refeições feitas! Isso sim é comprometimento. Continue assim! 🔥",
  "Nutrição em dia, resultado garantido. Tô de olho e aprovando! ✅",
];

// ══════════════════════════════════════════════════════════
// Pós-Treino Agressivo - provocação para compartilhar
// ══════════════════════════════════════════════════════════
export const POST_WORKOUT_SHARE = [
  "Volume de {volume}kg batido! Sério que você vai guardar esse treino só pra você? Mostra quem manda no seu dia! 💪",
  "Treino de {volume}kg finalizado. Quem treina pesado não esconde. Compartilha esse card! 🏆",
  "{volume}kg de volume total. Isso é resultado de quem não brinca em serviço. Bora mostrar! 🔥",
  "Acabou de destruir {volume}kg de volume. O Instagram precisa ver isso. Compartilha! 📱",
  "Treino monstro: {volume}kg. Agora é hora de inspirar alguém. Manda esse card! 💥",
];

// ══════════════════════════════════════════════════════════
// Nutri - 10% chance on 50% diet completed
// ══════════════════════════════════════════════════════════
export const NUTRI_WATCHING_HALF = [
  "Já passou da metade das refeições! Tô vendo que tá firme hoje. 👀🍎",
  "50% da dieta concluída. O ritmo tá bom, mantém assim até o final! 💪",
  "Metade das refeições batidas. Se continuar assim, o resultado vem rápido! ✅",
];

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function fillTemplate(msg: string, vars: Record<string, string | number>): string {
  let result = msg;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return result;
}

/** Returns true ~10% of the time */
export function shouldTrigger(chance = 0.10): boolean {
  return Math.random() < chance;
}
