import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AuthPage } from "./AuthPage";
import { BlossomScene } from "./BlossomScene";
import { ChatPage } from "./ChatPage";
import { InboxPage } from "./InboxPage";
import { SettingsPage } from "./SettingsPage";

export default function App() {
  const { user, loading, t } = useAuth();

  if (loading) {
    return (
      <div className="boot-screen">
        <p className="brand-mark">{t.brand}</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-with-blossom">
      <BlossomScene density={18} className="blossom-dim" />
      <Routes>
        <Route path="/" element={<InboxPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
