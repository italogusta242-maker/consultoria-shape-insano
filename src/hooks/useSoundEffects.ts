/**
 * Hook para efeitos sonoros usando Web Audio API.
 * Sons sintetizados — sem arquivos MP3 externos.
 */

let audioCtx: AudioContext | null = null;

const getCtx = () => {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
};

/** Toque curto de confirmação (série confirmada) */
const playConfirm = () => {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(880, ctx.currentTime);
  o.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.2);
};

/** Fanfarra de vitória (treino completo) */
const playVictory = () => {
  const ctx = getCtx();
  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
    g.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
    o.start(ctx.currentTime + i * 0.15);
    o.stop(ctx.currentTime + i * 0.15 + 0.4);
  });
};

/** Som de XP / level up — sweep ascendente */
const playXpGain = () => {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(400, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.35);
};

/** Notificação — bell-like */
const playNotification = () => {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(1047, ctx.currentTime); // C6
  o.frequency.setValueAtTime(784, ctx.currentTime + 0.1); // G5
  g.gain.setValueAtTime(0.1, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.3);
};

/** Chama acendendo — whoosh crescente */
const playFlameIgnite = () => {
  const ctx = getCtx();
  // Noise-based whoosh via oscillator sweep
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sawtooth";
  o.frequency.setValueAtTime(100, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
  o.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.6);
  g.gain.setValueAtTime(0.05, ctx.currentTime);
  g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.2);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.6);
};

/** Erro / falha — buzz curto */
const playError = () => {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "square";
  o.frequency.setValueAtTime(200, ctx.currentTime);
  o.frequency.setValueAtTime(150, ctx.currentTime + 0.1);
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.2);
};

/** Click / tap leve */
const playTap = () => {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(600, ctx.currentTime);
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.06);
};

/** Água — bolha */
const playWaterDrop = () => {
  const ctx = getCtx();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(1500, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.1, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.2);
};

/** Apito de treinador — coach whistle (Olho do Dono) */
const playCoachWhistle = () => {
  const ctx = getCtx();
  // High pitch whistle sweep
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "sine";
  o.frequency.setValueAtTime(2200, ctx.currentTime);
  o.frequency.setValueAtTime(2800, ctx.currentTime + 0.1);
  o.frequency.setValueAtTime(2400, ctx.currentTime + 0.25);
  g.gain.setValueAtTime(0.12, ctx.currentTime);
  g.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.4);
  // Add a second harmonic for whistle character
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.connect(g2);
  g2.connect(ctx.destination);
  o2.type = "sine";
  o2.frequency.setValueAtTime(4400, ctx.currentTime);
  o2.frequency.setValueAtTime(5600, ctx.currentTime + 0.1);
  g2.gain.setValueAtTime(0.04, ctx.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  o2.start(ctx.currentTime);
  o2.stop(ctx.currentTime + 0.35);
};

/** Anilhas batendo — gym plates clack (Pós-treino) */
const playGymPlates = () => {
  const ctx = getCtx();
  // Short metallic impact using noise-like high-freq burst
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g);
  g.connect(ctx.destination);
  o.type = "square";
  o.frequency.setValueAtTime(150, ctx.currentTime);
  o.frequency.setValueAtTime(80, ctx.currentTime + 0.05);
  g.gain.setValueAtTime(0.2, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  o.start(ctx.currentTime);
  o.stop(ctx.currentTime + 0.15);
  // Second hit (double clack)
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.connect(g2);
  g2.connect(ctx.destination);
  o2.type = "sawtooth";
  o2.frequency.setValueAtTime(200, ctx.currentTime + 0.08);
  o2.frequency.setValueAtTime(60, ctx.currentTime + 0.12);
  g2.gain.setValueAtTime(0, ctx.currentTime);
  g2.gain.setValueAtTime(0.18, ctx.currentTime + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  o2.start(ctx.currentTime + 0.08);
  o2.stop(ctx.currentTime + 0.25);
  // Metallic ring
  const o3 = ctx.createOscillator();
  const g3 = ctx.createGain();
  o3.connect(g3);
  g3.connect(ctx.destination);
  o3.type = "sine";
  o3.frequency.setValueAtTime(3200, ctx.currentTime);
  g3.gain.setValueAtTime(0.05, ctx.currentTime);
  g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  o3.start(ctx.currentTime);
  o3.stop(ctx.currentTime + 0.3);
};

export const SFX = {
  confirm: playConfirm,
  victory: playVictory,
  xp: playXpGain,
  notification: playNotification,
  flameIgnite: playFlameIgnite,
  error: playError,
  tap: playTap,
  waterDrop: playWaterDrop,
  coachWhistle: playCoachWhistle,
  gymPlates: playGymPlates,
} as const;

export type SfxName = keyof typeof SFX;

export const useSoundEffects = () => {
  const play = (name: SfxName) => {
    try {
      SFX[name]();
    } catch {
      // Ignore audio errors silently
    }
  };
  return { play };
};
