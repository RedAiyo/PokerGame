import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginRegister from './components/LoginRegister';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import Settings from './components/Settings';

export type View = 'main' | 'lobby' | 'game' | 'settings';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<View>('main');
  const [roomId, setRoomId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginRegister />;
  }

  return (
    <>
      {currentView === 'main' && <MainMenu setView={setCurrentView} />}
      {currentView === 'lobby' && (
        <Lobby setView={setCurrentView} onJoinRoom={(id: string) => { setRoomId(id); setCurrentView('game'); }} />
      )}
      {currentView === 'game' && roomId && (
        <GameTable setView={setCurrentView} roomId={roomId} />
      )}
      {currentView === 'settings' && <Settings setView={setCurrentView} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
        <AppContent />
      </div>
    </AuthProvider>
  );
}
