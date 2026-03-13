import { useState } from 'react';
import { X, Users, Coins, Clock, Loader2 } from 'lucide-react';
import { useRooms } from '../hooks/useRooms';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export default function CreateRoomModal({ onClose, onCreated }: Props) {
  const { profile } = useAuth();
  const { createRoom, joinRoom } = useRooms();
  const [roomName, setRoomName] = useState(`${profile?.username || '玩家'} 的房间`);
  const [blinds, setBlinds] = useState('10/20');
  const [maxPlayers, setMaxPlayers] = useState(9);
  const [timeLimit, setTimeLimit] = useState(15);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const blindsMap: Record<string, { sb: number; bb: number; type: string; minBuy: number; maxBuy: number }> = {
    '10/20': { sb: 10, bb: 20, type: '新手场', minBuy: 100, maxBuy: 1000 },
    '50/100': { sb: 50, bb: 100, type: '初级场', minBuy: 500, maxBuy: 5000 },
    '200/400': { sb: 200, bb: 400, type: '高级场', minBuy: 2000, maxBuy: 20000 },
  };

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const b = blindsMap[blinds];
      const room = await createRoom({
        name: roomName,
        small_blind: b.sb,
        big_blind: b.bb,
        min_buy_in: b.minBuy,
        max_buy_in: b.maxBuy,
        max_players: maxPlayers,
        time_limit: timeLimit,
        room_type: b.type,
        is_private: isPrivate,
        password: isPrivate ? password : undefined,
      } as any);
      await joinRoom(room.id, undefined, room.min_buy_in, isPrivate ? password : undefined);
      onCreated(room.id);
    } catch (err: any) {
      setError(err.message || '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">创建房间</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Room Name */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">房间名称</label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="输入房间名称"
            />
          </div>

          {/* Blinds */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
              <Coins className="w-4 h-4" /> 盲注级别
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['10/20', '50/100', '200/400'].map((level) => (
                <button
                  key={level}
                  onClick={() => setBlinds(level)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                    blinds === level
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Players & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> 人数上限
              </label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value={2}>2 人 (单挑)</option>
                <option value={6}>6 人桌</option>
                <option value={9}>9 人桌</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" /> 操作限时
              </label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 appearance-none"
              >
                <option value={10}>10 秒 (极速)</option>
                <option value={15}>15 秒 (标准)</option>
                <option value={30}>30 秒 (宽松)</option>
              </select>
            </div>
          </div>

          {/* Private Room Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700">
            <div>
              <div className="font-medium text-white mb-1">私人房间</div>
              <div className="text-xs text-slate-400">开启后需要密码才能加入</div>
            </div>
            <div
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${isPrivate ? 'bg-blue-500' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${isPrivate ? 'right-1' : 'left-1'}`}></div>
            </div>
          </div>

          {isPrivate && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="设置 4-6 位数字密码"
                maxLength={6}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 shadow-lg shadow-blue-900/20 transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? '创建中...' : '确认创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
