import { lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSilentUpdate } from "@/hooks/useSilentUpdate";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Eagerly load structural components to avoid black screen on navigation
import RoleGuard from "./components/RoleGuard";
import StudentGuard from "./components/StudentGuard";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";
import Onboarding from "./pages/Onboarding";

// Eagerly load layout shells so navigation is instant
import AdminLayout from "./components/admin/AdminLayout";
import EspecialistaLayout from "./components/especialista/EspecialistaLayout";
import CloserLayout from "./components/closer/CloserLayout";
import CSLayout from "./components/cs/CSLayout";

// Lazy load page content only
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ChatEspecialistas = lazy(() => import("./pages/ChatEspecialistas"));
const ChatConversation = lazy(() => import("./pages/ChatConversation"));
const Perfil = lazy(() => import("./pages/Perfil"));
const MinhaEvolucao = lazy(() => import("./pages/MinhaEvolucao"));
const ConviteAcesso = lazy(() => import("./pages/ConviteAcesso"));
const BattleMode = lazy(() => import("./pages/BattleMode"));
const InstalarApp = lazy(() => import("./pages/InstalarApp"));
const ChatNotificationToast = lazy(() => import("./components/ChatNotificationToast"));
const PWAInstallBanner = lazy(() => import("./components/PWAInstallBanner"));

const Treinos = lazy(() => import("./pages/Treinos"));
const Dieta = lazy(() => import("./pages/Dieta"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));

const AdminEspecialistas = lazy(() => import("./pages/admin/AdminEspecialistas"));
const AdminComunicacao = lazy(() => import("./pages/admin/AdminComunicacao"));
const AdminRelatorios = lazy(() => import("./pages/admin/AdminRelatorios"));

const AdminImportarAlunos = lazy(() => import("./pages/admin/AdminImportarAlunos"));
const AdminPermissoes = lazy(() => import("./pages/admin/AdminPermissoes"));
const AdminAnamneses = lazy(() => import("./pages/admin/AdminAnamneses"));

const AdminClosers = lazy(() => import("./pages/admin/AdminClosers"));
const EspecialistaDashboard = lazy(() => import("./pages/especialista/EspecialistaDashboard"));
const EspecialistaAlunos = lazy(() => import("./pages/especialista/EspecialistaAlunos"));
const EspecialistaPlanos = lazy(() => import("./pages/especialista/EspecialistaPlanos"));
const EspecialistaTreino = lazy(() => import("./pages/especialista/EspecialistaTreino"));
const EspecialistaDieta = lazy(() => import("./pages/especialista/EspecialistaDieta"));

const EspecialistaChat = lazy(() => import("./pages/especialista/EspecialistaChat"));
const EspecialistaPerfil = lazy(() => import("./pages/especialista/EspecialistaPerfil"));
const EspecialistaAlimentos = lazy(() => import("./pages/especialista/EspecialistaAlimentos"));
const EspecialistaExercicios = lazy(() => import("./pages/especialista/EspecialistaExercicios"));
const EspecialistaAnamneseSplit = lazy(() => import("./pages/especialista/EspecialistaAnamneseSplit"));
const EspecialistaIA = lazy(() => import("./pages/especialista/EspecialistaIA"));
const MonthlyAssessment = lazy(() => import("./pages/monthly-assessment/MonthlyAssessment"));
const CloserDashboard = lazy(() => import("./pages/closer/CloserDashboard"));
const CloserProdutos = lazy(() => import("./pages/closer/CloserProdutos"));
const CloserApresentacao = lazy(() => import("./pages/closer/CloserApresentacao"));
const CSDashboard = lazy(() => import("./pages/cs/CSDashboard"));
const CSAlunos = lazy(() => import("./pages/cs/CSAlunos"));
const CSProfissionais = lazy(() => import("./pages/cs/CSProfissionais"));
const CSRetencao = lazy(() => import("./pages/cs/CSRetencao"));
const CSChat = lazy(() => import("./pages/cs/CSChat"));
const queryClient = new QueryClient();

// Invisible fallback — layout stays rendered, no visual loading indicator
const PageLoader = () => null;

const AppRoutes = () => {
  const location = useLocation();
  const { user, loading, onboarded, setOnboarded } = useAuth();

  const isServiceRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/especialista") || location.pathname.startsWith("/closer") || location.pathname.startsWith("/cs");
  const isInviteRoute = location.pathname.startsWith("/convite");
  const isInstallRoute = location.pathname === "/instalar";

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#FF6B00' }}>
      <img src="/insano-logo-branco.svg" alt="Shape Insano" className="w-32 h-32 object-contain animate-pulse" />
      <div className="mt-6 w-48 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <div className="h-full rounded-full animate-loading-bar" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }} />
      </div>
      <p className="mt-4 font-cinzel text-sm tracking-[0.3em] uppercase" style={{ color: 'rgba(255,255,255,0.7)' }}>
        Carregando...
      </p>
    </div>
  );

  // Public routes - no auth required
  if (isInviteRoute || isInstallRoute) {
    return (
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/convite/:token" element={<ConviteAcesso />} />
        <Route path="/instalar" element={<InstalarApp />} />
      </Routes>
      </Suspense>
    );
  }

  if (!user && !isServiceRoute) {
    return <AuthPage />;
  }

  // Only gate onboarding for student routes, not service routes
  if (user && !onboarded && !isServiceRoute) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <>
      <Suspense fallback={null}>
        <ChatNotificationToast />
        <PWAInstallBanner />
      </Suspense>
      <Suspense fallback={<PageLoader />}>
      <Routes>
      <Route element={<StudentGuard />}>
        <Route element={<AppLayout dishonorMode={false} setDishonorMode={() => {}} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/dieta" element={<Dieta />} />
          <Route path="/chat" element={<ChatEspecialistas />} />
          <Route path="/chat/:conversationId" element={<ChatConversation />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/perfil/evolucao" element={<MinhaEvolucao />} />
        </Route>
        <Route path="/reavaliacao" element={<MonthlyAssessment />} />
        <Route path="/instalar" element={<InstalarApp />} />
        <Route path="/batalha" element={<BattleMode />} />
      </Route>
      <Route element={<RoleGuard allowedRoles={["admin"]} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/usuarios" element={<AdminUsuarios />} />
          
          <Route path="/admin/importar" element={<AdminImportarAlunos />} />
          <Route path="/admin/permissoes" element={<AdminPermissoes />} />
          <Route path="/admin/especialistas" element={<AdminEspecialistas />} />
          <Route path="/admin/closers" element={<AdminClosers />} />
          <Route path="/admin/comunicacao" element={<AdminComunicacao />} />
          <Route path="/admin/relatorios" element={<AdminRelatorios />} />
          <Route path="/admin/anamneses" element={<AdminAnamneses />} />


        </Route>
      </Route>
      <Route element={<RoleGuard allowedRoles={["personal", "nutricionista"]} />}>
        <Route element={<EspecialistaLayout />}>
          <Route path="/especialista" element={<EspecialistaDashboard />} />
          <Route path="/especialista/alunos" element={<EspecialistaAlunos />} />
          <Route path="/especialista/planos" element={<EspecialistaPlanos />} />
          <Route path="/especialista/treinos" element={<EspecialistaAlunos />} />
          <Route path="/especialista/dietas" element={<EspecialistaAlunos />} />
          <Route path="/especialista/anamnese/:studentId" element={<EspecialistaAnamneseSplit />} />
          <Route path="/especialista/chat" element={<EspecialistaChat />} />
          <Route path="/especialista/alimentos" element={<EspecialistaAlimentos />} />
          <Route path="/especialista/exercicios" element={<EspecialistaExercicios />} />
          <Route path="/especialista/perfil" element={<EspecialistaPerfil />} />
          <Route path="/especialista/ia" element={<EspecialistaIA />} />
        </Route>
      </Route>
      <Route element={<RoleGuard allowedRoles={["closer"]} />}>
        <Route element={<CloserLayout />}>
          <Route path="/closer" element={<CloserDashboard />} />
          <Route path="/closer/produtos" element={<CloserProdutos />} />
          <Route path="/closer/apresentacao" element={<CloserApresentacao />} />
        </Route>
      </Route>
      <Route element={<RoleGuard allowedRoles={["cs"]} />}>
        <Route element={<CSLayout />}>
          <Route path="/cs" element={<CSDashboard />} />
          <Route path="/cs/chat" element={<CSChat />} />
          <Route path="/cs/alunos" element={<CSAlunos />} />
          <Route path="/cs/profissionais" element={<CSProfissionais />} />
          <Route path="/cs/retencao" element={<CSRetencao />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
      </Suspense>
    </>
  );
};

const App = () => {
  useSilentUpdate();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
