import { useState } from 'react';
import { ChevronLeft, Plus, Coins, Diamond, User, Loader2 } from 'lucide-react';
import CreateRoomModal from './CreateRoomModal';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../context/AuthContext';

interface LobbyProps {
  setView: (v: any) => void;
  onJoinRoom: (roomId: string) => void;
}

export default function Lobby({ setView, onJoinRoom }: LobbyProps) {
  const { profile } = useAuth();
  const { rooms, loading, fetchRooms, joinRoom } = useRooms();
  const [activeCategory, setActiveCategory] = useState('所有房间');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const categories = ['所有房间', '新手场', '初级场', '高级场', '大师场'];

  const filteredRooms = activeCategory === '所有房间'
    ? rooms
    : rooms.filter(room => room.type === activeCategory);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (cat === '所有房间') {
      fetchRooms();
    } else {
      fetchRooms(cat);
    }
  };

  const handleJoinRoom = async (room: any) => {
    try {
      setJoining(room.id);
      await joinRoom(room.id, undefined, room.min_buy_in);
      onJoinRoom(room.id);
    } catch (err: any) {
      alert(err.message || '加入房间失败');
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('main')} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-semibold">游戏大厅</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-medium">{profile?.coins?.toLocaleString() || '0'}</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full">
            <Diamond className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{(profile as any)?.diamonds || '0'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full overflow-hidden flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="font-medium">{profile?.username || '玩家'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 p-4 border-r border-slate-800 flex flex-col gap-2 relative">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`text-left px-4 py-3 rounded-xl transition-colors ${
                activeCategory === cat ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}

          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">创建房间</span>
            </button>
          </div>
        </div>

        {/* Room Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p className="text-lg">暂无房间</p>
              <p className="text-sm mt-2">点击下方按钮创建一个新房间</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
              {filteredRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => handleJoinRoom(room)}
                  className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 hover:bg-slate-800 hover:border-slate-500 transition-all cursor-pointer group relative"
                >
                  {joining === room.id && (
                    <div className="absolute inset-0 bg-slate-900/80 rounded-2xl flex items-center justify-center z-10">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium group-hover:text-blue-400 transition-colors">{room.name}</h3>
                    {room.is_private && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">私密</span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-slate-400">
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border border-slate-500 flex items-center justify-center text-[10px]">B</span> 盲注</span>
                      <span className="text-slate-200">{room.small_blind}/{room.big_blind}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2"><User className="w-4 h-4" /> 玩家</span>
                      <span className="text-slate-200">{room.player_count || 0}/{room.max_players}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-2"><Coins className="w-4 h-4" /> 买入</span>
                      <span className="text-slate-200">{room.min_buy_in}/{room.max_buy_in}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(roomId: string) => {
            setShowCreateModal(false);
            onJoinRoom(roomId);
          }}
        />
      )}
    </div>
  );
}
