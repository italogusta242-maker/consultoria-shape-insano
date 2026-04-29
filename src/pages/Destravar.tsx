import { useEffect } from "react";
import heroImage from "@/assets/destravar/hero-athlete.jpg";
import mentorImage from "@/assets/destravar/mentor-portrait.jpg";
import logoFlame from "@/assets/destravar/logo-flame.png";

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

function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={logoFlame}
        alt="Shape Insano"
        width={48}
        height={48}
        className="h-12 w-12"
        style={{ filter: tokens.glow }}
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

const Destravar = () => {
  // Set page title
  useEffect(() => {
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
          width={1024}
          height={1536}
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
          <a
            href="#"
            className="group relative inline-flex items-center justify-center w-full max-w-md px-8 py-5 rounded-xl font-extrabold text-lg sm:text-xl tracking-wide uppercase transition-all duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none"
            style={{
              backgroundColor: tokens.ctaGreen,
              color: "black",
              boxShadow: tokens.shadowCta,
            }}
          >
            Entrar no Grupo VIP!
          </a>
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
            width={1024}
            height={1280}
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
    </main>
  );
};

export default Destravar;
