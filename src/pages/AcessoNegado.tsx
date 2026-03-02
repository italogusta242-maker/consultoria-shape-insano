import { ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AcessoNegado = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="text-center max-w-md">
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: 'rgba(255,107,0,0.15)' }}>
          <ShieldOff size={40} style={{ color: '#FF6B00' }} />
        </div>

        <h1 className="text-3xl font-cinzel font-bold text-white mb-2">
          Acesso Negado
        </h1>

        <p className="text-sm tracking-widest uppercase mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Erro 403
        </p>

        <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Você não tem permissão para acessar esta página. Entre em contato com o administrador se acredita que isso é um erro.
        </p>

        <Button
          onClick={() => navigate("/", { replace: true })}
          className="font-cinzel tracking-wider"
          style={{ backgroundColor: '#FF6B00', color: '#fff' }}
        >
          Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default AcessoNegado;
