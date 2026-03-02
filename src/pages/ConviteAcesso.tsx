import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import InsanoLogo from "@/components/InsanoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Loader2, UserCheck } from "lucide-react";

const ConviteAcesso = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<{ email: string; name: string | null; cpf: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("invites")
        .select("email, name, cpf, status, expires_at")
        .eq("token", token)
        .eq("status", "pending")
        .maybeSingle();

      if (error || !data) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      if (!data.cpf || data.cpf.replace(/\D/g, "").length < 11) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      setInvite({ email: data.email, name: data.name, cpf: data.cpf });
      setLoading(false);
    };

    fetchInvite();
  }, [token]);

  const handleConfirm = async () => {
    if (!invite || !invite.cpf) return;

    setSubmitting(true);

    // Use CPF (numbers only) as password
    const cpfPassword = invite.cpf.replace(/\D/g, "");

    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password: cpfPassword,
      options: {
        data: { nome: invite.name },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      // If user already exists, try to sign in
      if (error.message.includes("already registered")) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invite.email,
          password: cpfPassword,
        });
        if (signInError) {
          toast.error("Erro ao acessar: " + signInError.message);
          setSubmitting(false);
          return;
        }
      } else {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }
    }

    toast.success("Conta criada com sucesso! Vamos começar sua anamnese.");
    navigate("/onboarding");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f40001" }}>
        <img src="/insano-icon-192.png" alt="Shape Insano" className="w-32 h-32 object-contain animate-pulse" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center gap-6">
        <InsanoLogo size={64} />
        <h1 className="text-2xl font-cinzel font-bold text-foreground">Convite Inválido</h1>
        <p className="text-muted-foreground max-w-md">
          Este link de convite é inválido, já foi utilizado, expirou ou não possui CPF cadastrado. 
          Entre em contato com a equipe Shape Insano para obter um novo link.
        </p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Ir para o login
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <InsanoLogo size={56} />
          <h1 className="text-2xl font-cinzel font-bold text-foreground">
            Bem-vindo à Elite
          </h1>
          <p className="text-muted-foreground text-sm">
            Confirme seus dados para acessar o Shape Insano PRO
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-muted-foreground">E-mail</Label>
            <div className="relative">
              <Input
                type="email"
                value={invite?.email ?? ""}
                disabled
                className="bg-muted/50 text-muted-foreground cursor-not-allowed pr-10"
              />
              <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            </div>
          </div>

          {invite?.name && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Nome</Label>
              <Input
                value={invite.name}
                disabled
                className="bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-muted-foreground">CPF (será sua senha inicial)</Label>
            <Input
              value={invite?.cpf ?? ""}
              disabled
              className="bg-muted/50 text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground/70">
              Seu CPF será utilizado como senha inicial. Você poderá alterá-la depois.
            </p>
          </div>

          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 text-base"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando sua conta...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Confirmar e Entrar
              </span>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground/50">
          Shape Insano PRO — Consultoria de Elite
        </p>
      </div>
    </div>
  );
};

export default ConviteAcesso;
