import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import NotificationCenter from "@/components/NotificationCenter";
import PushPermissionBanner from "@/components/PushPermissionBanner";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface AppLayoutProps {
  dishonorMode: boolean;
  setDishonorMode: (v: boolean) => void;
}

const AppLayout = ({ dishonorMode, setDishonorMode }: AppLayoutProps) => {
  const { pushState, requestPermission } = usePushNotifications();
  const location = useLocation();

  // Hide top notification bar on chat conversation pages (they have their own header)
  const isChatConversation = /^\/chat\/[^/]+/.test(location.pathname);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar with notification center — hidden inside chat conversations */}
      {!isChatConversation && (
        <header className="sticky top-0 z-40 flex items-center justify-end px-4 py-2 supports-[backdrop-filter]:bg-background/70 bg-background/95 backdrop-blur-xl backdrop-saturate-150 border-b border-border/40">
          <NotificationCenter />
        </header>
      )}
      <PushPermissionBanner pushState={pushState} onRequestPermission={requestPermission} />
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
