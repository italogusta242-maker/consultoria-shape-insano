import { Component, type ReactNode } from "react";
import { hardPurgeCaches } from "@/lib/pwaCache";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recovering: boolean;
}

const RECOVERY_FLAG = "lovable:chunk-recovery-attempted";

/** Detects "stale chunk after deploy" errors. */
export function isStaleChunkError(err: unknown): boolean {
  const msg = (err as any)?.message || String(err || "");
  const name = (err as any)?.name || "";
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    name === "ChunkLoadError"
  );
}

/** Hard-purge caches + reload. Uses sessionStorage flag to avoid infinite loops. */
export async function recoverFromStaleChunk(): Promise<boolean> {
  try {
    if (sessionStorage.getItem(RECOVERY_FLAG)) {
      // Already tried once this session — give up to avoid loop
      return false;
    }
    sessionStorage.setItem(RECOVERY_FLAG, String(Date.now()));
  } catch {
    /* ignore — still try to recover */
  }

  await hardPurgeCaches();

  try {
    await fetch(window.location.href, { cache: "no-store" });
  } catch {
    /* ignore */
  }

  window.location.reload();
  return true;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, recovering: isStaleChunkError(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);

    if (isStaleChunkError(error)) {
      // Fire-and-forget; if recovery returns false (already tried), we just stay on the screen
      recoverFromStaleChunk().then((didReload) => {
        if (!didReload) {
          this.setState({ recovering: false });
        }
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.recovering) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="max-w-md w-full text-center space-y-4">
              <div className="mx-auto w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <h1 className="text-xl font-bold text-foreground">Atualizando o app…</h1>
              <p className="text-sm text-muted-foreground">
                Detectamos uma versão nova. Recarregando automaticamente.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold text-foreground">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            <p className="text-xs text-muted-foreground/60 bg-muted/30 rounded-lg p-3 font-mono break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem(RECOVERY_FLAG);
                } catch {
                  /* ignore */
                }
                window.location.reload();
              }}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
