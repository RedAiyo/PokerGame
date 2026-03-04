import { User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MainMenu({ setView }: { setView: (v: any) => void }) {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-800 to-slate-950">
      <div className="absolute top-8 flex items-center gap-3 bg-slate-800/50 px-6 py-3 rounded-full border border-slate-700/50 backdrop-blur-sm">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center overflow-hidden border-2 border-blue-400">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-white" />
          )}
        </div>
        <span className="text-xl font-semibold tracking-wide text-white">{profile?.username || '玩家'}</span>
      </div>

      <h1 className="text-7xl font-bold mb-20 tracking-widest text-white drop-shadow-lg">德州扑克</h1>

      <div className="flex gap-6">
        <button
          onClick={() => setView('lobby')}
          className="px-12 py-4 text-xl font-medium rounded-xl border-2 border-slate-400 text-white hover:border-white hover:bg-white/5 transition-all duration-200"
        >
          加入游戏
        </button>
        <button
          onClick={() => setView('settings')}
          className="px-12 py-4 text-xl font-medium rounded-xl border-2 border-slate-400 text-white hover:border-white hover:bg-white/5 transition-all duration-200"
        >
          设置
        </button>
        <button
          onClick={async () => { await signOut(); }}
          className="px-12 py-4 text-xl font-medium rounded-xl border-2 border-slate-400 text-white hover:border-white hover:bg-white/5 transition-all duration-200 flex items-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          退出游戏
        </button>
      </div>
    </div>
  );
}
