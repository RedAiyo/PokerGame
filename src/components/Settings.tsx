import { useState } from 'react';
import { ChevronLeft, User, Settings as SettingsIcon, Monitor, Shield, HelpCircle, LogOut, RotateCcw, Check } from 'lucide-react';
import EditProfileModal from './EditProfileModal';
import { useAuth } from '../context/AuthContext';
import { useSettings, defaultSettings, type Settings as UserSettings } from '../hooks/useSettings';

type ToggleSettingKey =
  | 'autoRebuy'
  | 'showHandStrength'
  | 'allowSpectators'
  | 'hapticFeedback'
  | 'highFrameRate'
  | 'hideOnlineStatus'
  | 'rejectStrangerMessages'
  | 'hideMatchHistory';

type VolumeSettingKey = 'masterVolume' | 'sfxVolume' | 'musicVolume';

export default function Settings({ setView }: { setView: (v: any) => void }) {
  const [activeTab, setActiveTab] = useState('game');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const { profile, signOut } = useAuth();
  const { settings, updateSettings, loading } = useSettings();
  const [activeHelpSection, setActiveHelpSection] = useState<'rules' | 'about' | null>(null);

  const tabs = [
    { id: 'account', icon: User, label: '账号管理' },
    { id: 'game', icon: SettingsIcon, label: '游戏偏好' },
    { id: 'display', icon: Monitor, label: '声音与显示' },
    { id: 'privacy', icon: Shield, label: '隐私设置' },
    { id: 'help', icon: HelpCircle, label: '帮助' },
  ];

  const toggleSetting = (key: ToggleSettingKey) => {
    void updateSettings({ [key]: !settings[key] } as Partial<UserSettings>);
  };

  const updateVolume = (key: VolumeSettingKey, value: number) => {
    void updateSettings({ [key]: value } as Partial<UserSettings>);
  };

  const resetSettings = () => {
    void updateSettings(defaultSettings);
  };

  const Switch = ({ checked, onChange, disabled = false }: { checked: boolean, onChange: () => void, disabled?: boolean }) => (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${checked ? 'bg-blue-500' : 'bg-slate-600'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 flex items-center justify-center ${checked ? 'right-1 translate-x-0' : 'left-1 translate-x-0'}`}>
        {checked && <Check className="w-3 h-3 text-blue-500" />}
      </div>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      <div className="flex items-center p-4 border-b border-slate-800">
        <button onClick={() => setView('main')} className="p-2 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2">
          <ChevronLeft className="w-6 h-6" />
          <span className="text-xl font-semibold">设置</span>
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-slate-800 p-4 flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setActiveHelpSection(null);
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === tab.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
          <div className="mt-auto">
            <button onClick={async () => { await signOut(); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">退出登录</span>
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-3xl">
            {activeTab === 'account' && (
              <div>
                <h2 className="text-2xl font-bold mb-2">账号管理</h2>
                <p className="text-slate-400 mb-8">管理您的个人资料和账号安全</p>
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-500 rounded-full overflow-hidden">
                         {profile?.avatar_url ? (
                           <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         ) : (
                           <User className="w-8 h-8 text-white" />
                         )}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium">{profile?.username || '玩家'}</h3>
                        <p className="text-sm text-slate-400">ID: {profile?.id?.slice(0, 8) || '---'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowEditProfile(true)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm"
                    >
                      修改资料
                    </button>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-lg font-medium mb-4">安全设置</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">修改密码</span>
                        <button className="text-blue-400 hover:text-blue-300 text-sm">去修改</button>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-300">绑定手机</span>
                        <span className="text-sm text-slate-400">已绑定 138****1234</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'game' && (
              <div>
                <h2 className="text-2xl font-bold mb-2">游戏偏好</h2>
                <p className="text-slate-400 mb-8">自定义您的德州扑克游戏体验</p>

                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">自动补码</h3>
                      <p className="text-sm text-slate-400">筹码低于初始买入时自动补充</p>
                    </div>
                    <Switch checked={settings.autoRebuy} onChange={() => toggleSetting('autoRebuy')} disabled={loading} />
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">显示牌力</h3>
                      <p className="text-sm text-slate-400">在游戏过程中提示当前手牌强度</p>
                    </div>
                    <Switch checked={settings.showHandStrength} onChange={() => toggleSetting('showHandStrength')} disabled={loading} />
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">允许观众</h3>
                      <p className="text-sm text-slate-400">允许其他玩家旁观您的牌局</p>
                    </div>
                    <Switch checked={settings.allowSpectators} onChange={() => toggleSetting('allowSpectators')} disabled={loading} />
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">振动反馈</h3>
                      <p className="text-sm text-slate-400">发牌、轮到操作时提供触觉反馈</p>
                    </div>
                    <Switch checked={settings.hapticFeedback} onChange={() => toggleSetting('hapticFeedback')} disabled={loading} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div>
                <h2 className="text-2xl font-bold mb-2">声音与显示</h2>
                <p className="text-slate-400 mb-8">调整音效和画面设置</p>
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-lg font-medium mb-4">音量控制</h3>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-slate-300">主音量</span>
                          <span className="text-sm text-slate-400">{settings.masterVolume}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={settings.masterVolume} onChange={(e) => updateVolume('masterVolume', Number(e.target.value))} className="w-full accent-blue-500" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-slate-300">游戏音效</span>
                          <span className="text-sm text-slate-400">{settings.sfxVolume}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={settings.sfxVolume} onChange={(e) => updateVolume('sfxVolume', Number(e.target.value))} className="w-full accent-blue-500" />
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-slate-300">背景音乐</span>
                          <span className="text-sm text-slate-400">{settings.musicVolume}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={settings.musicVolume} onChange={(e) => updateVolume('musicVolume', Number(e.target.value))} className="w-full accent-blue-500" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">高帧率模式</h3>
                      <p className="text-sm text-slate-400">开启后游戏画面更流畅，但会增加耗电</p>
                    </div>
                    <Switch checked={settings.highFrameRate} onChange={() => toggleSetting('highFrameRate')} disabled={loading} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div>
                <h2 className="text-2xl font-bold mb-2">隐私设置</h2>
                <p className="text-slate-400 mb-8">管理您的隐私和可见性</p>
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">隐藏在线状态</h3>
                      <p className="text-sm text-slate-400">开启后其他玩家无法看到您是否在线</p>
                    </div>
                    <Switch checked={settings.hideOnlineStatus} onChange={() => toggleSetting('hideOnlineStatus')} disabled={loading} />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">拒绝陌生人消息</h3>
                      <p className="text-sm text-slate-400">只接收好友发送的消息</p>
                    </div>
                    <Switch checked={settings.rejectStrangerMessages} onChange={() => toggleSetting('rejectStrangerMessages')} disabled={loading} />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium mb-1">隐藏历史战绩</h3>
                      <p className="text-sm text-slate-400">其他玩家无法查看您的历史游戏记录</p>
                    </div>
                    <Switch checked={settings.hideMatchHistory} onChange={() => toggleSetting('hideMatchHistory')} disabled={loading} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'help' && (
              <div>
                <h2 className="text-2xl font-bold mb-2">帮助与支持</h2>
                <p className="text-slate-400 mb-8">了解游戏规则或关注我们</p>
                
                {!activeHelpSection ? (
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setActiveHelpSection('rules')}
                      className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-left hover:bg-slate-800 transition-colors"
                    >
                      <h3 className="text-lg font-medium mb-2 text-blue-400">游戏规则</h3>
                      <p className="text-sm text-slate-400">了解德州扑克的基本玩法、牌型大小和下注规则</p>
                    </button>
                    <button 
                      onClick={() => setActiveHelpSection('about')}
                      className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 text-left hover:bg-slate-800 transition-colors"
                    >
                      <h3 className="text-lg font-medium mb-2 text-blue-400">关注我们</h3>
                      <p className="text-sm text-slate-400">获取最新资讯，加入玩家社区</p>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                    <button 
                      onClick={() => setActiveHelpSection(null)}
                      className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>返回帮助列表</span>
                    </button>

                    {activeHelpSection === 'rules' && (
                      <div className="prose prose-invert max-w-none">
                        <h3 className="text-xl font-bold mb-4 text-white">德州扑克基本规则</h3>
                        
                        <h4 className="text-lg font-semibold mt-6 mb-2 text-blue-300">游戏目标</h4>
                        <p className="text-slate-300 text-sm leading-relaxed mb-4">
                          德州扑克使用52张标准扑克牌（不含鬼牌）。每位玩家会发到两张面朝下的「底牌」，这是玩家私有的牌。随后牌桌上会依次发出五张面朝上的「公共牌」。玩家的目标是使用自己的两张底牌和五张公共牌，共七张牌中，挑选出最好的五张牌组成最大牌型，以赢得底池中的筹码。
                        </p>

                        <h4 className="text-lg font-semibold mt-6 mb-2 text-blue-300">牌局流程</h4>
                        <ol className="list-decimal list-inside text-slate-300 text-sm space-y-2 mb-4">
                          <li><strong>下盲注：</strong> 庄家左侧两名玩家分别下小盲注和大盲注。</li>
                          <li><strong>发底牌：</strong> 每位玩家获得两张底牌。</li>
                          <li><strong>翻牌前 (Pre-flop)：</strong> 从大盲注左侧玩家开始第一轮下注。</li>
                          <li><strong>翻牌圈 (Flop)：</strong> 发出三张公共牌，进行第二轮下注。</li>
                          <li><strong>转牌圈 (Turn)：</strong> 发出第四张公共牌，进行第三轮下注。</li>
                          <li><strong>河牌圈 (River)：</strong> 发出第五张公共牌，进行最后一轮下注。</li>
                          <li><strong>摊牌 (Showdown)：</strong> 若有多名玩家未盖牌，则亮出底牌比大小。</li>
                        </ol>

                        <h4 className="text-lg font-semibold mt-6 mb-2 text-blue-300">牌型大小 (由大到小)</h4>
                        <ul className="list-disc list-inside text-slate-300 text-sm space-y-1 mb-4">
                          <li><strong>皇家同花顺：</strong> 同花色的 A, K, Q, J, 10</li>
                          <li><strong>同花顺：</strong> 五张同花色且连续的牌</li>
                          <li><strong>四条 (铁支)：</strong> 四张同点数的牌</li>
                          <li><strong>葫芦：</strong> 三条 + 一对</li>
                          <li><strong>同花：</strong> 五张同花色的牌</li>
                          <li><strong>顺子：</strong> 五张连续点数的牌</li>
                          <li><strong>三条：</strong> 三张同点数的牌</li>
                          <li><strong>两对：</strong> 两个不同的对子</li>
                          <li><strong>对子：</strong> 两张同点数的牌</li>
                          <li><strong>高牌 (散牌)：</strong> 不符合以上任何牌型，比最大单张</li>
                        </ul>
                      </div>
                    )}

                    {activeHelpSection === 'about' && (
                      <div className="space-y-6">
                        <h3 className="text-xl font-bold mb-4 text-white">关注我们</h3>
                        <p className="text-slate-300 text-sm">
                          感谢您游玩我们的德州扑克应用！加入我们的社区，获取最新活动资讯、游戏更新和专属福利。
                        </p>
                        
                        <div className="grid gap-4">
                          <a href="#" className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">X</div>
                            <div>
                              <div className="font-medium text-white">Twitter / X</div>
                              <div className="text-xs text-slate-400">@TexasHoldemApp</div>
                            </div>
                          </a>
                          
                          <a href="#" className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
                            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">D</div>
                            <div>
                              <div className="font-medium text-white">Discord 社区</div>
                              <div className="text-xs text-slate-400">与全球玩家交流技巧</div>
                            </div>
                          </a>

                          <a href="#" className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors border border-slate-700">
                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">W</div>
                            <div>
                              <div className="font-medium text-white">微信公众号</div>
                              <div className="text-xs text-slate-400">搜索 "德州扑克官方"</div>
                            </div>
                          </a>
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                          <p className="text-xs text-slate-500">版本 1.0.0 (Build 20260304)</p>
                          <p className="text-xs text-slate-500 mt-1">© 2026 Texas Hold'em Studio. All rights reserved.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button onClick={resetSettings} disabled={loading} className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-60 transition-colors">
                <RotateCcw className="w-4 h-4" />
                <span>恢复默认设置</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </div>
  );
}
