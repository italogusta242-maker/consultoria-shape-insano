import { useEffect, useState, FormEvent } from "react";
import heroImage from "@/assets/destravar/hero-athlete.jpg";
import mentorImage from "@/assets/destravar/mentor-portrait.jpg";
import insanoLogo from "@/assets/insano-logo.svg";

// Brand tokens (kept local to this page so the rest of the app's design system stays intact)
const tokens = {
  background: "oklch(0.08 0.005 50)",
  foreground: "oklch(0.98 0.005 80)",
  card: "oklch(0.13 0.01 50)",
  border: "oklch(0.22 0.01 50)",
  muted: "oklch(0.7 0.02 60)",
  brandOrange: "oklch(0.72 0.2 45)",
  ctaGreen: "oklch(0.78 0.24 142)",
  shadowCta:
    "0 8px 0 oklch(0.4 0.18 142), 0 14px 30px oklch(0.78 0.24 142 / 0.4)",
  glow: "drop-shadow(0 0 18px oklch(0.72 0.2 45 / 0.7))",
  glowSoft: "drop-shadow(0 0 18px oklch(0.72 0.2 45 / 0.6))",
};

// 🔗 Link do grupo VIP (substituir quando usuário enviar)
const VIP_GROUP_URL = "https://chat.whatsapp.com/";

// Faixas etárias — "abaixo de 21" é desqualificada para o Meta
const AGE_RANGES = [
  { value: "under_21", label: "Menos de 21 anos", qualified: false },
  { value: "21_29", label: "21 a 29 anos", qualified: true },
  { value: "30_39", label: "30 a 39 anos", qualified: true },
  { value: "40_49", label: "40 a 49 anos", qualified: true },
  { value: "50_plus", label: "50 anos ou mais", qualified: true },
];

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

// 🎯 Captura e persiste parâmetros de tracking (UTMs + fbclid) da URL.
// Persiste em sessionStorage para sobreviver à abertura do modal e a recargas
// dentro da mesma sessão. Primeira visita ganha prioridade (não sobrescreve).
const TRACKING_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

type TrackingParams = Partial<Record<(typeof TRACKING_KEYS)[number], string>>;

const TRACKING_STORAGE_KEY = "destravar_tracking";

function captureTrackingParams(): TrackingParams {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl: TrackingParams = {};
    for (const key of TRACKING_KEYS) {
      const v = params.get(key);
      if (v) fromUrl[key] = v;
    }

    const stored = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
    const prev: TrackingParams = stored ? JSON.parse(stored) : {};

    // Primeira ocorrência ganha (não sobrescreve uma campanha já registrada
    // se o usuário recarregar sem parâmetros).
    const merged: TrackingParams = { ...fromUrl, ...prev };
    if (Object.keys(merged).length > 0) {
      window.sessionStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return {};
  }
}

function getTrackingParams(): TrackingParams {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(TRACKING_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function appendTrackingToUrl(url: string, tracking: TrackingParams): string {
  const entries = Object.entries(tracking).filter(([, v]) => !!v);
  if (entries.length === 0) return url;
  try {
    const u = new URL(url);
    for (const [k, v] of entries) u.searchParams.set(k, v as string);
    return u.toString();
  } catch {
    // URL relativa ou inválida — fallback simples
    const sep = url.includes("?") ? "&" : "?";
    const qs = entries
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
      .join("&");
    return `${url}${sep}${qs}`;
  }
}

function Logo({ className = "", size = 48 }: { className?: string; size?: number }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={insanoLogo}
        alt="Shape Insano"
        width={size}
        height={size}
        style={{ height: size, width: size, filter: tokens.glow }}
      />
      <span
        className="text-2xl sm:text-3xl font-extrabold tracking-tight"
        style={{ color: tokens.foreground }}
      >
        Shape<span style={{ opacity: 0.9 }}>Insano</span>
      </span>
    </div>
  );
}

function LeadModal({ onClose }: { onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    ageRange: "",
    profession: "",
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.whatsapp || !form.ageRange || !form.profession) return;

    setSubmitting(true);
    const selected = AGE_RANGES.find((a) => a.value === form.ageRange);
    const qualified = selected?.qualified ?? false;
    const tracking = getTrackingParams();

    // 🎯 Disparo Meta Pixel APENAS para público qualificado (21+)
    // Público desqualificado segue o mesmo fluxo, mas SEM evento "Lead"
    if (qualified && typeof window !== "undefined" && typeof window.fbq === "function") {
      try {
        window.fbq("track", "Lead", {
          content_name: "Shape Insano - Grupo VIP Destrava",
          age_range: form.ageRange,
          ...tracking,
        });
      } catch (err) {
        console.warn("Meta Pixel error:", err);
      }
    }

    // Redireciona todos para o grupo (qualificados ou não), preservando UTMs
    window.location.href = appendTrackingToUrl(VIP_GROUP_URL, tracking);
  };

  const inputBase =
    "w-full rounded-full border-2 px-5 py-4 text-base bg-white text-black placeholder:text-zinc-500 focus:outline-none focus:border-black transition-colors";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 text-zinc-500 hover:text-black transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center"
        >
          ×
        </button>

        <div className="flex flex-col items-center mb-6">
          <img src={insanoLogo} alt="Shape Insano" className="h-14 w-14 mb-2" />
          <span className="text-2xl font-extrabold tracking-tight text-black">
            Shape<span className="opacity-90">Insano</span>
          </span>
        </div>

        <h3 className="text-xl font-bold text-center text-black mb-6">
          Preencha seus dados abaixo:
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            placeholder="* Nome"
            className={inputBase}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={100}
          />
          <input
            type="email"
            required
            placeholder="* E-mail"
            className={inputBase}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            maxLength={255}
          />
          <input
            type="tel"
            required
            placeholder="* WhatsApp (com DDD)"
            className={inputBase}
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            maxLength={20}
          />
          <select
            required
            className={inputBase}
            value={form.ageRange}
            onChange={(e) => setForm({ ...form, ageRange: e.target.value })}
          >
            <option value="" disabled>
              * Sua faixa etária
            </option>
            {AGE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="* Qual sua profissão?"
            className={inputBase}
            value={form.profession}
            onChange={(e) => setForm({ ...form, profession: e.target.value })}
            maxLength={100}
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 px-6 py-5 rounded-xl font-extrabold text-lg tracking-wide uppercase transition-all duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-70"
            style={{
              backgroundColor: tokens.ctaGreen,
              color: "black",
              boxShadow: tokens.shadowCta,
            }}
          >
            {submitting ? "Aguarde..." : "Segurar minha vaga!"}
          </button>
        </form>
      </div>
    </div>
  );
}

const Destravar = () => {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Captura UTMs/fbclid na primeira visita e persiste para o submit
    captureTrackingParams();
    const prev = document.title;
    document.title = "Shape Insano — Destrava | Grupo VIP";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <main
      className="min-h-screen antialiased"
      style={{ backgroundColor: tokens.background, color: tokens.foreground }}
    >
      {/* HERO */}
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Atleta com físico estético em academia escura com chama laranja ao fundo"
          className="w-full h-auto object-cover"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-40"
          style={{
            background: `linear-gradient(to top, ${tokens.background}, transparent)`,
          }}
        />
      </section>

      {/* CONTENT */}
      <section className="px-5 sm:px-8 pb-12 -mt-6 relative z-10 max-w-2xl mx-auto">
        <Logo className="mb-8" />

        <h1 className="text-[2rem] sm:text-5xl leading-[1.05] font-extrabold tracking-tight">
          Construa um corpo{" "}
          <span style={{ color: tokens.brandOrange }}>
            estético, forte e funcional
          </span>{" "}
          sem usar bomba e sem depender de genética em 90 dias.
        </h1>

        <div
          className="mt-8 space-y-6 text-lg sm:text-xl leading-relaxed"
          style={{ color: tokens.foreground, opacity: 0.9 }}
        >
          <p>
            No dia <strong>11/05</strong> eu vou liberar um{" "}
            <strong>SUPER DESCONTO do Shape Insano PRO,</strong> a minha
            consultoria e comunidade individualizada de treino e dieta.
          </p>
          <p>
            Porém, todas as informações sobre a oferta serão reveladas{" "}
            <strong>única e exclusivamente para quem estiver no GRUPO VIP</strong>{" "}
            de super interessados.
          </p>
          <p className="font-bold">
            Clique no botão abaixo para entrar no grupo:
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="group relative inline-flex items-center justify-center w-full max-w-md px-8 py-5 rounded-xl font-extrabold text-lg sm:text-xl tracking-wide uppercase transition-all duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            style={{
              backgroundColor: tokens.ctaGreen,
              color: "black",
              boxShadow: tokens.shadowCta,
            }}
          >
            Entrar no Grupo VIP!
          </button>
        </div>
      </section>

      {/* MENTOR */}
      <section className="px-5 sm:px-8 py-12 max-w-2xl mx-auto">
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: tokens.card, border: `1px solid ${tokens.border}` }}
        >
          <img
            src={mentorImage}
            alt="Igor Correa, mentor do Shape Insano PRO"
            loading="lazy"
            className="w-full aspect-[4/5] object-cover"
          />
          <div className="px-6 py-6 text-center">
            <h2
              className="text-3xl sm:text-4xl font-extrabold tracking-tight"
              style={{ color: tokens.foreground, filter: tokens.glowSoft }}
            >
              IGOR CORREA
            </h2>
            <p className="mt-2 text-lg" style={{ color: tokens.muted }}>
              @iigorcorrea
            </p>
          </div>
        </div>

        <h3 className="mt-12 text-3xl sm:text-4xl font-extrabold leading-tight text-center">
          <span style={{ color: tokens.brandOrange }}>O seu mentor</span>{" "}
          no Shape Insano PRO
        </h3>

        <div
          className="mt-8 space-y-6 text-lg leading-relaxed"
          style={{ color: tokens.foreground, opacity: 0.9 }}
        >
          <p>
            Igor Correa é influenciador e atleta de fisiculturismo natural, além
            de estudante de Educação Física. Em 2021, com um físico magro,
            começou assim como você, com muita vontade e disposição pra colocar
            um shape que fizesse dele uma referência.
          </p>
          <p>
            Com seu estilo de vida, Igor ajuda e ensina alunos por todo o Brasil
            a saírem da "mesmice" e alcançar o Shape mais Insano de suas vidas.
            Hoje, o intuito é mostrar aos jovens e adultos que uma saúde
            impecável e uma estética atraente podem andar lado a lado sem abrir
            mão de curtir a vida.
          </p>
          <p>
            Com mais de 500 mil pessoas impactadas todos os meses nas redes
            sociais, o Clube Shape Insano te espera. Ambiente certo, com a
            metodologia correta irão transformar sua vida pra sempre.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center justify-center w-full max-w-md px-8 py-5 rounded-xl font-extrabold text-lg sm:text-xl tracking-wide uppercase transition-all duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            style={{
              backgroundColor: tokens.ctaGreen,
              color: "black",
              boxShadow: tokens.shadowCta,
            }}
          >
            Entrar no Grupo VIP!
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="mt-8"
        style={{ borderTop: `1px solid ${tokens.brandOrange}99` }}
      >
        <div className="max-w-2xl mx-auto px-5 py-10 flex flex-col items-center gap-4">
          <Logo />
          <p className="text-sm text-center" style={{ color: tokens.muted }}>
            © Copyright 2026 | Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {modalOpen && <LeadModal onClose={() => setModalOpen(false)} />}
    </main>
  );
};

export default Destravar;
