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

export const SFX = {
  confirm: playConfirm,
  victory: playVictory,
  xp: playXpGain,
  notification: playNotification,
  flameIgnite: playFlameIgnite,
  error: playError,
  tap: playTap,
  waterDrop: playWaterDrop,
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
