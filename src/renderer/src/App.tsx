import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { RecoveryItem } from "@shared/types";
import { Brand } from "./components/Brand";
import { RecoveryDialog } from "./components/RecoveryDialog";
import { AppCloseProvider } from "./features/lifecycle/AppCloseContext";
import { EditorWorkspacePage } from "./pages/EditorWorkspacePage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { ThemeProvider } from "./features/theme/ThemeContext";

function AppShell() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/editor/");

  return (
    <div className="app-shell-surfaces">
      <section
        className={`app-shell-surface ${!isEditor ? "is-visible" : ""}`}
        inert={isEditor ? true : undefined}
      >
        <WorkspacePage visible={!isEditor} />
      </section>
      <section
        className={`app-shell-surface ${isEditor ? "is-visible" : ""}`}
        inert={!isEditor ? true : undefined}
      >
        <EditorWorkspacePage visible={isEditor} />
      </section>
    </div>
  );
}

export default function App() {
  const { workspace, initialized, initialize } = useWorkspaceStore();
  const [recoveryItems, setRecoveryItems] = useState<RecoveryItem[]>([]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!workspace?.isAvailable) {
      setRecoveryItems([]);
      return;
    }
    void window.desktopApi.recovery.list().then(setRecoveryItems);
  }, [workspace]);

  if (!initialized) {
    return (
      <div className="app-loading">
        <Brand compact />
        <p>正在读取本地画布…</p>
      </div>
    );
  }

  if (!workspace?.isAvailable) {
    return (
      <AppCloseProvider>
        <WelcomePage unavailableWorkspace={workspace} />
      </AppCloseProvider>
    );
  }

  return (
    <ThemeProvider>
      <AppCloseProvider>
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/editor/:documentId" element={<AppShell />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {recoveryItems.length > 0 && (
        <RecoveryDialog
          items={recoveryItems}
          onItemsChange={setRecoveryItems}
        />
      )}
      </AppCloseProvider>
    </ThemeProvider>
  );
}
