import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Menu, MessageSquare, Clock, User, X, Play, Loader2 } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { useChat } from '../hooks/useChat';
import { useAuth } from '../context/AuthContext';

interface GameTableProps {
  setView: (v: any) => void;
  roomId: string;
}

export default function GameTable({ setView, roomId }: GameTableProps) {
  const { profile } = useAuth();
  const { gameState, loading, startGame, sendAction } = useGame(roomId);
  const { messages, sendMessage } = useChat(roomId);
  const [showChat, setShowChat] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [raiseAmount, setRaiseAmount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isInGame = gameState && gameState.phase !== 'waiting';
  const myPlayer = gameState?.players?.find((p: any) => p.id === profile?.id);
  const currentBet = gameState?.currentBet || 0;
  const myBet = myPlayer?.bet || 0;
  const toCall = currentBet - myBet;
  const isMyTurn = myPlayer?.isCurrentTurn;
  const minRaise = gameState?.minRaise ?? gameState?.bigBlind ?? 20;
  const minRaiseTotal = currentBet > 0 ? currentBet + minRaise : minRaise;
  const maxRaiseTotal = myPlayer ? myPlayer.chips + myBet : minRaiseTotal;
  const canRaise = Boolean(isMyTurn && maxRaiseTotal >= minRaiseTotal);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    setRaiseAmount((previousAmount) => {
      if (maxRaiseTotal <= 0) {
        return 0;
      }
      if (maxRaiseTotal < minRaiseTotal) {
        return maxRaiseTotal;
      }
      if (previousAmount < minRaiseTotal || previousAmount > maxRaiseTotal) {
        return minRaiseTotal;
      }
      return previousAmount;
    });
  }, [maxRaiseTotal, minRaiseTotal]);

  const handleFold = async () => {
    if (gameState?.id) await sendAction(gameState.id, 'fold');
  };

  const handleCall = async () => {
    if (gameState?.id) {
      if (toCall === 0) {
        await sendAction(gameState.id, 'check');
      } else {
        await sendAction(gameState.id, 'call');
      }
    }
  };

  const handleRaise = async () => {
    if (gameState?.id && canRaise) await sendAction(gameState.id, 'raise', raiseAmount);
  };

  const handleStartGame = async () => {
    await startGame(roomId);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    await sendMessage(chatInput.trim());
    setChatInput('');
  };

  const suitSymbol: Record<string, string> = {
    hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
    h: '♥', d: '♦', c: '♣', s: '♠',
  };

  // Player positions around the table (max 9 seats)
  const seatPositions = [
    'absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4', // 0 - bottom center (hero)
    'absolute left-0 bottom-1/4 -translate-x-1/2', // 1 - bottom left
    'absolute top-0 left-1/4 -translate-x-1/2 -translate-y-1/2', // 2 - top left
    'absolute top-4 left-1/2 -translate-x-1/2', // 3 - top center
    'absolute top-0 right-1/4 translate-x-1/2 -translate-y-1/2', // 4 - top right
    'absolute right-0 bottom-1/4 translate-x-1/2', // 5 - bottom right
    'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2', // 6 - left
    'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2', // 7 - right
    'absolute bottom-0 right-1/4 translate-x-1/2 translate-y-1/4', // 8 - bottom right 2
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-950 relative overflow-hidden font-sans">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('lobby')} className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {gameState?.phase ? `阶段: ${gameState.phase}` : '等待开始'}
            </h2>
            <p className="text-xs text-slate-400">
              底池: ${gameState?.pot || 0}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-800/80 px-4 py-1.5 rounded-full flex items-center gap-2 border border-slate-700">
            <span className="text-yellow-500 font-bold">$</span>
            <span className="font-medium text-white">{myPlayer?.chips?.toLocaleString() || profile?.coins?.toLocaleString() || '0'}</span>
          </div>
          <button className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-5xl aspect-[2/1] bg-emerald-800 rounded-[200px] border-[16px] border-slate-800 shadow-2xl relative flex items-center justify-center shadow-black/50">
          <div className="absolute inset-4 rounded-[180px] border-2 border-emerald-700/50"></div>

          {/* Community Cards & Pot */}
          <div className="flex flex-col items-center gap-4 z-10">
            <div className="bg-slate-900/80 px-6 py-2 rounded-full border border-slate-700/50 text-center">
              <div className="text-xs text-slate-400 mb-0.5">总底池</div>
              <div className="text-xl font-bold text-yellow-500">${gameState?.pot || 0}</div>
            </div>

            <div className="flex gap-2">
              {(gameState?.communityCards || []).map((card: any, i: number) => {
                const rank = typeof card === 'string' ? card.slice(0, -1) : card.rank;
                const suit = typeof card === 'string' ? card.slice(-1) : card.suit;
                return <CardView key={i} rank={rank} suit={suit} />;
              })}
              {/* Empty slots for remaining community cards */}
              {Array.from({ length: Math.max(0, 5 - (gameState?.communityCards?.length || 0)) }).map((_, i) => (
                <div key={`empty-${i}`} className="w-16 h-24 rounded-lg bg-emerald-900/50 border-2 border-emerald-700/30"></div>
              ))}
            </div>
          </div>

          {/* Start Game Button (shown when no active game) */}
          {!isInGame && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <button
                onClick={handleStartGame}
                disabled={loading}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-2xl font-medium text-lg transition-colors shadow-lg flex items-center gap-3"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
                开始游戏
              </button>
            </div>
          )}

          {/* Players */}
          {(gameState?.players || []).map((player: any, index: number) => {
            const posClass = seatPositions[player.seatIndex % seatPositions.length];
            const isMe = player.id === profile?.id;
            const isActive = player.isCurrentTurn;
            const isFolded = player.folded;

            return (
              <div key={player.id || index} className={`${posClass} flex flex-col items-center`}>
                {isActive && (
                  <div className="absolute -top-10 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap z-30">
                    思考中...
                  </div>
                )}
                <PlayerAvatar
                  name={isMe ? `您 (${player.username || profile?.username})` : (player.username || `玩家${player.seatIndex}`)}
                  chips={isFolded ? '弃牌' : `$${player.chips}`}
                  active={isActive}
                  folded={isFolded}
                />
                {/* Show hole cards for hero, card backs for others */}
                {!isFolded && isInGame && (
                  <div className="mt-2 flex gap-1">
                    {isMe && gameState?.holeCards ? (
                      gameState.holeCards.map((card: any, ci: number) => {
                        const rank = typeof card === 'string' ? card.slice(0, -1) : card.rank;
                        const suit = typeof card === 'string' ? card.slice(-1) : card.suit;
                        return <CardView key={ci} rank={rank} suit={suit} className={ci === 0 ? '-rotate-6' : 'rotate-6 -ml-4'} />;
                      })
                    ) : isMe && (myPlayer?.holeCards || []).length > 0 ? (
                      (myPlayer.holeCards as any[]).map((card: any, ci: number) => {
                        const rank = typeof card === 'string' ? card.slice(0, -1) : card.rank;
                        const suit = typeof card === 'string' ? card.slice(-1) : card.suit;
                        return <CardView key={ci} rank={rank} suit={suit} className={ci === 0 ? '-rotate-6' : 'rotate-6 -ml-4'} />;
                      })
                    ) : (
                      <>
                        <div className="w-8 h-12 bg-blue-600 rounded border border-blue-400 shadow-sm transform -rotate-6"></div>
                        <div className="w-8 h-12 bg-blue-600 rounded border border-blue-400 shadow-sm transform rotate-6 -ml-4"></div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className="absolute bottom-24 left-6 w-80 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden z-40 animate-in slide-in-from-bottom-4 duration-200">
          <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
            <h3 className="font-medium text-white">聊天室</h3>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 h-64 p-4 overflow-y-auto space-y-3 text-sm">
            <div className="text-slate-400 text-center text-xs">欢迎来到房间</div>
            {messages.map((msg) => (
              <div key={msg.id}>
                <span className="text-blue-400 font-medium">{msg.username}:</span>{' '}
                <span className="text-slate-200">{msg.message}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-slate-800 bg-slate-800/50 flex gap-2">
            <input
              type="text"
              placeholder="输入消息..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleSendChat}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      )}

      {/* History Panel */}
      {showHistory && (
        <div className="absolute bottom-24 left-20 w-80 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden z-40 animate-in slide-in-from-bottom-4 duration-200">
          <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
            <h3 className="font-medium text-white">对局记录</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 h-64 p-4 overflow-y-auto space-y-3 text-sm text-slate-400 text-center">
            对局记录将在游戏中显示
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-end pointer-events-none">
        <div className="flex gap-4 pointer-events-auto">
          <button
            onClick={() => { setShowChat(!showChat); if (showHistory) setShowHistory(false); }}
            className={`w-12 h-12 rounded-full flex items-center justify-center border backdrop-blur-sm transition-colors ${
              showChat ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); if (showChat) setShowChat(false); }}
            className={`w-12 h-12 rounded-full flex items-center justify-center border backdrop-blur-sm transition-colors ${
              showHistory ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons - only show when it's our turn */}
        {isInGame && (
          <div className="flex flex-col items-end gap-4 pointer-events-auto">
            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700 backdrop-blur-sm flex items-center gap-4 w-80">
              <span className="text-sm text-slate-300 whitespace-nowrap">加注至</span>
              <input
                type="range"
                min={Math.min(minRaiseTotal, maxRaiseTotal)}
                max={Math.max(minRaiseTotal, maxRaiseTotal)}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                disabled={!canRaise}
                className="flex-1 accent-blue-500 disabled:opacity-50"
              />
              <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 font-mono text-sm text-white">
                ${raiseAmount}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFold}
                disabled={!isMyTurn}
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-xl font-medium text-lg transition-colors border border-slate-600"
              >
                弃牌
              </button>
              <button
                onClick={handleCall}
                disabled={!isMyTurn}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium text-lg transition-colors shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center leading-tight"
              >
                <span>{toCall === 0 ? '过牌' : '跟注'}</span>
                {toCall > 0 && <span className="text-sm text-blue-200">${toCall}</span>}
              </button>
              <button
                onClick={handleRaise}
                disabled={!canRaise}
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium text-lg transition-colors shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center leading-tight"
              >
                <span>加注</span>
                <span className="text-sm text-blue-200">${raiseAmount}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerAvatar({ name, chips, active, folded }: { name: string, chips: string, active?: boolean, folded?: boolean }) {
  return (
    <div className={`flex flex-col items-center ${folded ? 'opacity-50' : ''}`}>
      <div className={`w-16 h-16 rounded-full overflow-hidden border-4 ${active ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border-slate-800'} mb-2 relative bg-slate-800 flex items-center justify-center`}>
        <User className="w-8 h-8 text-slate-400" />
      </div>
      <div className="bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-700 text-center min-w-[80px]">
        <div className="text-xs font-medium text-slate-200 truncate">{name}</div>
        <div className={`text-xs font-bold ${folded ? 'text-slate-500' : 'text-yellow-500'}`}>{chips}</div>
      </div>
    </div>
  );
}

function CardView({ rank, suit, className = '' }: { rank: string, suit: string, className?: string }) {
  const suitMap: Record<string, string> = {
    hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
    h: '♥', d: '♦', c: '♣', s: '♠',
  };
  const isRed = suit === 'hearts' || suit === 'diamonds' || suit === 'h' || suit === 'd';
  const symbol = suitMap[suit] || suit;

  return (
    <div className={`w-16 h-24 bg-white rounded-lg border border-slate-200 shadow-md flex flex-col justify-between p-2 ${className}`}>
      <div className={`text-lg font-bold leading-none ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {rank}
      </div>
      <div className={`text-2xl self-center ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {symbol}
      </div>
    </div>
  );
}
