import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, PieChart } from "lucide-react";
import AdminPlanosPagamento from "./AdminPlanosPagamento";
import AdminCobrar from "./AdminCobrar";

// Original financial dashboard content
import AdminFinanceiroDashboard from "./AdminFinanceiroDashboard";

const AdminFinanceiro = () => {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-cinzel text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Planos, cobranças e dashboard financeiro</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="dashboard" className="gap-2">
            <PieChart size={14} /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="planos" className="gap-2">
            <Wallet size={14} /> Planos
          </TabsTrigger>
          <TabsTrigger value="cobrar" className="gap-2">
            <Receipt size={14} /> Gerar Cobrança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <AdminFinanceiroDashboard />
        </TabsContent>
        <TabsContent value="planos" className="mt-6">
          <AdminPlanosPagamento />
        </TabsContent>
        <TabsContent value="cobrar" className="mt-6">
          <AdminCobrar />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminFinanceiro;
