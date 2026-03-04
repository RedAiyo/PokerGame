import { useState } from 'react';
import { X, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export default function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [nickname, setNickname] = useState(profile?.username || '');
  const [bio, setBio] = useState((profile as any)?.bio || '');
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">修改资料</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden group cursor-pointer border-4 border-slate-800">
              <img 
                src="https://picsum.photos/seed/user1/200/200" 
                alt="Avatar" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <span className="text-sm text-slate-400">点击更换头像</span>
          </div>

          {/* Nickname */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">昵称</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="输入新昵称"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">个性签名</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              rows={3}
              placeholder="介绍一下自己..."
            />
          </div>
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
            onClick={async () => {
              setSaving(true);
              try {
                await api.put('/auth/profile', { username: nickname, bio });
                onClose();
              } catch (err: any) {
                alert(err.message || '保存失败');
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-colors"
          >
            {saving ? '保存中...' : '保存更改'}
          </button>
        </div>
      </div>
    </div>
  );
}
