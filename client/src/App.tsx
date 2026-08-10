import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthPage } from "./AuthPage";
import { BlossomScene } from "./BlossomScene";
import { BrandLogo } from "./BrandLogo";
import { ChatPage } from "./ChatPage";
import { InboxPage } from "./InboxPage";
import { MessageNotifications } from "./MessageNotifications";
import { SettingsPage } from "./SettingsPage";
import { SocketProvider } from "./SocketProvider";

function AuthenticatedApp() {
  const { theme } = useAuth();

  return (
    <SocketProvider>
      <MessageNotifications />
      <div className="app-with-blossom">
        <BlossomScene
          density={theme === "dark" ? 18 : 10}
          className="blossom-dim"
        />
        <Routes>
          <Route path="/" element={<InboxPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </SocketProvider>
  );
}

export default function App() {
  const { user, loading, t } = useAuth();

  if (loading) {
    return (
      <div className="boot-screen">
        <BrandLogo size="lg" />
        <p className="brand-mark">{t.brand}</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedApp />;
}
