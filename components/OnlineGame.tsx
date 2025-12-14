import React, { useState, useEffect, useRef } from 'react';
import { peerService } from '../services/peerService';
import { AnswerType, NetworkPacket, PacketType, ChatMessage, PlayerProfile } from '../types';
import { Send, User, RefreshCw, Trophy, Crown, Check, Sparkles, Heart, History, Medal, Wifi, AlertTriangle } from 'lucide-react';

interface Props {
  myProfile: PlayerProfile;
  onBack: () => void;
}

enum Phase {
  CONNECTING = 'CONNECTING',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  ERROR = 'ERROR'
}

interface GameHistory {
  tuyWins: number;
  rickWins: number;
  matches: Array<{
    winner: 'TUY' | 'RICK';
    character: string;
    date: string;
  }>;
}

const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const OnlineGame: React.FC<Props> = ({ myProfile, onBack }) => {
  // --- CONNECTION STATE ---
  const [phase, setPhase] = useState<Phase>(Phase.CONNECTING);
  const [connectionStatus, setConnectionStatus] = useState('Conectando ao servidor...');
  const [errorMessage, setErrorMessage] = useState('');
  
  // IDs v3 para resetar sessões antigas
  const TUY_ID = 'tuy-player-id-love-game-v3';
  const RICK_ID = 'rick-player-id-love-game-v3';
  
  const myPeerId = myProfile === 'TUY' ? TUY_ID : RICK_ID;
  const targetPeerId = myProfile === 'TUY' ? RICK_ID : TUY_ID;

  // --- GAME LOGIC STATE ---
  const [myCharacter, setMyCharacter] = useState('');           
  const [opponentCharacter, setOpponentCharacter] = useState(''); 
  const [setupInput, setSetupInput] = useState('');
  
  // Chat & Turnos
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
  const [isMyTurn, setIsMyTurn] = useState(false); 
  const [gameResult, setGameResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);

  const [historyData, setHistoryData] = useState<GameHistory>({ tuyWins: 0, rickWins: 0, matches: [] });

  const scrollRef = useRef<HTMLDivElement>(null);
  const handlePacketRef = useRef<(packet: NetworkPacket) => void>(() => {});

  // --- PERSISTÊNCIA ---
  useEffect(() => {
    const saved = localStorage.getItem('tuy_rick_game_history');
    if (saved) {
      try {
        setHistoryData(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar histórico", e);
      }
    }
  }, []);

  const saveVictory = (winnerProfile: PlayerProfile, character: string) => {
    setHistoryData(prev => {
      const newData = {
        ...prev,
        tuyWins: winnerProfile === 'TUY' ? prev.tuyWins + 1 : prev.tuyWins,
        rickWins: winnerProfile === 'RICK' ? prev.rickWins + 1 : prev.rickWins,
        matches: [
          { winner: winnerProfile, character, date: new Date().toLocaleDateString('pt-BR') },
          ...prev.matches
        ].slice(0, 50)
      };
      localStorage.setItem('tuy_rick_game_history', JSON.stringify(newData));
      return newData;
    });
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, phase]);

  // Detector de Início de Jogo
  useEffect(() => {
    if (phase === Phase.SETUP && myCharacter && opponentCharacter) {
      setPhase(Phase.PLAYING);
      // Regra inicial: A TUY sempre começa perguntando
      setIsMyTurn(myProfile === 'TUY');
    }
  }, [phase, myCharacter, opponentCharacter, myProfile]);

  // Reenvio automático da escolha
  useEffect(() => {
    let interval: any;
    if (phase === Phase.SETUP && myCharacter) {
        peerService.send(PacketType.EXCHANGE_CHARACTER, myCharacter);
        interval = setInterval(() => {
            peerService.send(PacketType.EXCHANGE_CHARACTER, myCharacter);
        }, 2000);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [phase, myCharacter]);

  // --- PACKET HANDLER ---
  useEffect(() => {
    handlePacketRef.current = (packet: NetworkPacket) => {
      switch (packet.type) {
        case PacketType.EXCHANGE_CHARACTER:
          if (opponentCharacter === packet.payload) return;
          setOpponentCharacter(packet.payload);
          if (myCharacter) {
             peerService.send(PacketType.EXCHANGE_CHARACTER, myCharacter);
          }
          break;

        case PacketType.MESSAGE:
          setMessages(prev => [...prev, {
            sender: 'opponent',
            type: 'text',
            content: packet.payload,
            timestamp: Date.now()
          }]);
          // Recebi pergunta: não faço nada com o turno ainda, 
          // continuo bloqueado até responder.
          break;

        case PacketType.ANSWER:
          setMessages(prev => [...prev, {
            sender: 'opponent',
            type: 'answer',
            content: packet.payload,
            timestamp: Date.now()
          }]);
          
          // LÓGICA CORRIGIDA: Eu perguntei, recebi a resposta.
          // Agora passo a vez para o outro perguntar.
          setIsMyTurn(false);
          break;

        case PacketType.GAME_WON:
          setGameResult('DEFEAT');
          setPhase(Phase.GAME_OVER);
          const winner = myProfile === 'TUY' ? 'RICK' : 'TUY';
          saveVictory(winner, myCharacter); 
          break;

        case PacketType.RESTART:
          fullReset(false);
          break;
      }
    };
  });

  // --- PEER INITIALIZATION ---
  const initializeConnection = async () => {
      setPhase(Phase.CONNECTING);
      setConnectionStatus(`Entrando como ${myProfile}...`);
      setErrorMessage('');

      try {
        await peerService.initialize(myPeerId);
        setConnectionStatus(`Procurando ${myProfile === 'TUY' ? 'o Rick' : 'a Tuy'}...`);
      } catch (err: any) {
        console.error(err);
        setPhase(Phase.ERROR);
        if (err.message === 'ID_TAKEN') {
            setErrorMessage(`O personagem ${myProfile} já está conectado! Verifique se você não tem outra aba aberta ou se a outra pessoa escolheu o mesmo personagem.`);
        } else {
            setErrorMessage('Falha ao conectar ao servidor. Verifique sua internet.');
        }
      }
  };

  useEffect(() => {
    let mounted = true;
    let connectInterval: any = null;

    initializeConnection();

    // Loop de tentativa de conexão com o oponente
    connectInterval = setInterval(() => {
        if (mounted && phase === Phase.CONNECTING && peerService.peer && (!peerService.conn || !peerService.conn.open)) {
            console.log("Tentando conectar ao oponente...");
            peerService.connect(targetPeerId);
        }
    }, 3000);

    peerService.onConnectCallback = () => {
      if (mounted) {
        setPhase(Phase.SETUP);
      }
    };

    peerService.onDataCallback = (packet) => {
      if (mounted) handlePacketRef.current(packet);
    };

    peerService.onCloseCallback = () => {
      if (mounted) {
        setConnectionStatus('Sinal perdido. Tentando reconectar...');
        setPhase(Phase.CONNECTING);
      }
    };

    return () => {
      mounted = false;
      if(connectInterval) clearInterval(connectInterval);
      peerService.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executa apenas na montagem

  // --- ACTIONS ---
  const retryConnection = () => {
      peerService.destroy();
      initializeConnection();
  };

  const confirmMyCharacter = () => {
    if (!setupInput.trim()) return;
    setMyCharacter(setupInput);
    peerService.send(PacketType.EXCHANGE_CHARACTER, setupInput);
  };

  const sendMessage = () => {
    if (!currentInput.trim()) return;
    const guess = normalizeString(currentInput);
    const target = normalizeString(opponentCharacter);

    if (opponentCharacter && guess === target) {
      setGameResult('VICTORY');
      setPhase(Phase.GAME_OVER);
      peerService.send(PacketType.GAME_WON, null); 
      saveVictory(myProfile, opponentCharacter); 
      return;
    }

    peerService.send(PacketType.MESSAGE, currentInput);
    setMessages(prev => [...prev, {
      sender: 'me',
      type: 'text',
      content: currentInput,
      timestamp: Date.now()
    }]);
    
    // Enviei pergunta, agora passo a vez (espero resposta)
    setIsMyTurn(false);
    setCurrentInput('');
  };

  const sendAnswer = (ans: AnswerType) => {
    peerService.send(PacketType.ANSWER, ans);
    setMessages(prev => [...prev, {
      sender: 'me',
      type: 'answer',
      content: ans,
      timestamp: Date.now()
    }]);
    
    // LÓGICA CORRIGIDA: Respondi a pergunta do oponente?
    // Agora ganho o direito de fazer a minha pergunta.
    setIsMyTurn(true);
  };

  const fullReset = (sendSignal: boolean) => {
    if (sendSignal) peerService.send(PacketType.RESTART);
    setMyCharacter('');
    setOpponentCharacter('');
    setSetupInput('');
    setMessages([]);
    setGameResult(null);
    setPhase(Phase.SETUP);
    setIsMyTurn(myProfile === 'TUY'); 
  };

  // --- RENDER UTILS ---
  const cardContainerClass = "flex flex-col h-full justify-center px-4 md:px-0";
  const cardBodyClass = "relative w-full max-w-md mx-auto bg-slate-800/80 backdrop-blur-md p-6 md:p-8 rounded-2xl border border-pink-500/20 shadow-2xl";

  const opponentName = myProfile === 'TUY' ? 'Rick' : 'Tuy';
  const myName = myProfile;

  // --- COMPONENTS ---
  const ScoreBoard = () => (
    <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 mb-2 text-xs md:text-sm border border-slate-700/50 w-full max-w-[200px] mx-auto">
        <div className="flex flex-col items-center px-2">
            <span className="text-pink-400 font-bold">TUY</span>
            <span className="text-white font-mono">{historyData.tuyWins}</span>
        </div>
        <div className="h-6 w-px bg-slate-700"></div>
        <div className="flex flex-col items-center px-2">
            <span className="text-blue-400 font-bold">RICK</span>
            <span className="text-white font-mono">{historyData.rickWins}</span>
        </div>
    </div>
  );

  if (phase === Phase.ERROR) return (
    <div className={cardContainerClass}>
      <div className={cardBodyClass}>
         <div className="flex flex-col items-center justify-center h-full text-center">
            <AlertTriangle className="w-16 h-16 mb-4 text-rose-500" />
            <h3 className="text-xl font-bold text-white mb-2">Ops! Algo deu errado.</h3>
            <p className="text-slate-400 text-sm mb-6">{errorMessage}</p>
            
            <button 
                onClick={retryConnection}
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl mb-3 shadow-lg transition-all active:scale-[0.98]"
            >
                Tentar Novamente
            </button>
            <button onClick={onBack} className="text-slate-500 underline text-sm">Voltar ao Menu</button>
        </div>
      </div>
    </div>
  );

  if (phase === Phase.CONNECTING) return (
    <div className={cardContainerClass}>
      <div className={cardBodyClass}>
         <div className="flex flex-col items-center justify-center h-full text-pink-400">
            <Heart className="w-12 h-12 mb-4 animate-bounce text-pink-500" fill="currentColor" />
            <p className="animate-pulse text-lg font-medium text-center">{connectionStatus}</p>
            <p className="text-xs text-slate-500 mt-4 text-center">Aguarde a conexão com o {opponentName}...</p>
            <button onClick={onBack} className="mt-8 text-slate-500 underline text-sm">Cancelar</button>
        </div>
      </div>
    </div>
  );

  if (phase === Phase.SETUP) return (
    <div className={cardContainerClass}>
      <div className={cardBodyClass}>
        <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-emerald-950/30 px-2 py-1 rounded-full border border-emerald-500/20 shadow-sm z-10">
           <Wifi size={12} className="text-emerald-500 animate-pulse" />
           <span className="text-[10px] text-emerald-500/80 font-bold tracking-wider">ONLINE</span>
        </div>

        <div className="text-center">
          <ScoreBoard />
          <div className="mt-4 bg-gradient-to-br from-pink-500 to-rose-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-800 shadow-lg">
             <User className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            Quem o {opponentName} vai ser?
          </h2>
          <p className="text-slate-400 mb-6 text-sm">
            Escolha o personagem que o {opponentName} terá que adivinhar.
          </p>
          
          {!myCharacter ? (
            <div className="space-y-4">
              <input 
                key="character-input"
                value={setupInput} 
                onChange={e => setSetupInput(e.target.value)} 
                placeholder={`Digite o personagem do ${opponentName}...`} 
                className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white text-center text-lg placeholder:text-slate-600 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all" 
              />
              <button 
                onClick={confirmMyCharacter} 
                disabled={!setupInput.trim()} 
                className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-pink-900/20 transition-all active:scale-[0.98]"
              >
                Confirmar Escolha
              </button>
            </div>
          ) : (
            <div className="text-pink-400 font-bold text-xl p-6 bg-pink-900/20 rounded-xl mb-4 border border-pink-500/50 animate-in zoom-in duration-300">
               {opponentName} será: <br/><span className="text-white text-2xl">{myCharacter}</span>
            </div>
          )}

          <div className="mt-8 border-t border-slate-700 pt-6">
            {!opponentCharacter ? (
              <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
                <div className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full"></div>
                <span>Esperando {opponentName} escolher quem VOCÊ é...</span>
                {myCharacter && (
                  <button onClick={() => {
                      setMyCharacter('');
                      peerService.send(PacketType.EXCHANGE_CHARACTER, '');
                  }} className="text-xs text-pink-400 hover:text-pink-300 underline p-2 transition-colors">
                    Mudar minha escolha
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold bg-emerald-950/40 p-3 rounded-lg border border-emerald-900/50 animate-in fade-in slide-in-from-bottom-2">
                <Check size={20} /> {opponentName} já escolheu quem você é!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (phase === Phase.GAME_OVER) return (
    <div className={cardContainerClass}>
      <div className={cardBodyClass}>
        <div className="text-center max-h-[80vh] overflow-y-auto scrollbar-hide">
          {gameResult === 'VICTORY' ? (
            <>
              <div className="relative inline-block">
                 <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 animate-pulse"></div>
                 <Trophy className="relative z-10 w-24 h-24 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
              </div>
              
              <h2 className="text-3xl font-black text-white mb-2">
                PARABÉNS {myName}!
              </h2>
              <p className="text-slate-400 mb-6 font-medium">Você acertou!</p>
              
              <div className="relative mb-8 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-rose-600 rounded-2xl blur opacity-25"></div>
                <div className="relative bg-slate-900 border border-pink-500/30 p-6 rounded-xl shadow-xl">
                   <p className="text-xs text-pink-500/70 uppercase tracking-[0.2em] mb-2 font-bold">Você era</p>
                   <div className="text-3xl font-black text-pink-100 tracking-wide uppercase break-words drop-shadow-md">
                     {opponentCharacter}
                   </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative inline-block">
                 <div className="absolute inset-0 bg-rose-500 blur-2xl opacity-10"></div>
                 <Crown className="relative z-10 w-24 h-24 text-rose-400 mx-auto mb-6" />
              </div>

              <h2 className="text-3xl font-bold text-white mb-2">{opponentName} Venceu!</h2>
              <p className="text-slate-400 mb-6">Você perdeu essa rodada.</p>
              
              <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-700 mb-6 shadow-inner">
                 <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2 font-bold flex items-center justify-center gap-2">
                   <Sparkles size={12} /> {opponentName} era
                 </p>
                 <div className="text-2xl font-bold text-indigo-300 tracking-wide uppercase break-words">
                   {myCharacter}
                 </div>
              </div>
            </>
          )}

          <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-700">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
               <Medal size={14} /> Placar Total
             </h3>
             <div className="flex justify-center items-center gap-8">
                <div className="text-center">
                    <div className="text-2xl font-black text-pink-500">{historyData.tuyWins}</div>
                    <div className="text-[10px] text-slate-500 font-bold">TUY</div>
                </div>
                <div className="text-slate-600 text-xl font-light">x</div>
                <div className="text-center">
                    <div className="text-2xl font-black text-blue-500">{historyData.rickWins}</div>
                    <div className="text-[10px] text-slate-500 font-bold">RICK</div>
                </div>
             </div>
          </div>

          {historyData.matches.length > 0 && (
            <div className="text-left bg-slate-900/30 rounded-xl p-4 mb-6">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                  <History size={14} /> Personagens Descobertos
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                    {historyData.matches.slice(0, 5).map((match, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-slate-800/50 pb-1 last:border-0">
                            <span className={match.winner === 'TUY' ? 'text-pink-400' : 'text-blue-400'}>
                                {match.character}
                            </span>
                            <span className="text-slate-600 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                                {match.winner}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <button 
            onClick={() => fullReset(true)} 
            className="w-full py-4 bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-pink-900/20"
          >
            <RefreshCw size={20} /> 
            Jogar Novamente
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 md:rounded-xl md:overflow-hidden md:border md:border-pink-900/30 md:shadow-2xl md:h-[calc(100vh-80px)] md:max-w-4xl">
      <div className="bg-slate-800/90 backdrop-blur p-2 md:p-3 grid grid-cols-[1fr_auto_1fr] items-center border-b border-slate-700 shrink-0 pt-safe z-10">
        <div className="flex flex-col items-start min-w-0">
          <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full max-w-[140px]">
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-tight">Você é</p>
            <p className="text-slate-400 font-mono tracking-widest text-sm leading-none">?????</p>
          </div>
        </div>

        <div className="px-2 flex flex-col items-center">
            <div className="flex gap-2 text-[10px] font-mono text-slate-500 mb-1">
                <span className={historyData.tuyWins > historyData.rickWins ? 'text-pink-400 font-bold' : ''}>T:{historyData.tuyWins}</span>
                <span>-</span>
                <span className={historyData.rickWins > historyData.tuyWins ? 'text-blue-400 font-bold' : ''}>R:{historyData.rickWins}</span>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap shadow-sm ${isMyTurn ? 'bg-pink-900/30 border-pink-500 text-pink-400 animate-pulse' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isMyTurn ? `VEZ DA ${myProfile}` : `VEZ DO ${opponentName.toUpperCase()}`}
            </div>
        </div>

        <div className="flex flex-col items-end min-w-0">
           <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full max-w-[140px] text-right">
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-tight">{opponentName} é</p>
            <p className="text-emerald-400 font-bold truncate text-sm" title={myCharacter}>{myCharacter}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-slate-900/50 overscroll-contain">
        <div className="flex justify-center my-4">
           <span className="text-[10px] md:text-xs text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50">
             Faça perguntas de "Sim" ou "Não". A vez alterna sempre!
           </span>
        </div>
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm md:text-base shadow-sm break-words ${
              msg.sender === 'me' 
                ? (msg.type === 'answer' ? 'bg-pink-900/60 text-pink-100 border border-pink-700/50' : 'bg-pink-600 text-white') 
                : (msg.type === 'answer' ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-700 text-white')
            } ${msg.sender === 'me' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
              {msg.content}
            </div>
            <span className="text-[10px] text-slate-600 px-1 mt-1 opacity-60">
                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        ))}
      </div>

      <div className="p-3 bg-slate-800 border-t border-slate-700 pb-safe">
        {!isMyTurn && messages.length > 0 && messages[messages.length-1].sender === 'opponent' && messages[messages.length-1].type === 'text' ? (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <p className="text-xs text-slate-400 text-center mb-2 font-medium">Responda para o {opponentName}:</p>
            <div className="grid grid-cols-3 gap-2">
              {[AnswerType.YES, AnswerType.NO, AnswerType.DONT_KNOW, AnswerType.MAYBE, AnswerType.PROBABLY, AnswerType.PROBABLY_NOT].map(ans => (
                <button key={ans} onClick={() => sendAnswer(ans)} className={`py-3 md:py-2 px-1 rounded-lg text-[10px] md:text-xs font-bold transition-all active:scale-95 shadow-sm border border-b-4 ${
                  (ans === AnswerType.NO || ans === AnswerType.PROBABLY_NOT) 
                  ? 'bg-rose-600 border-rose-800 hover:bg-rose-500 text-white' 
                  : 'bg-slate-600 border-slate-800 hover:bg-slate-500 text-white'
                }`}>
                  {ans}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
             <input 
               value={currentInput}
               onChange={e => setCurrentInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && sendMessage()}
               placeholder={isMyTurn ? `Perguntar ao ${opponentName}...` : `Aguarde o ${opponentName}...`}
               disabled={!isMyTurn}
               className={`flex-1 bg-slate-950 border border-slate-600 text-white px-4 py-3.5 rounded-full focus:outline-none focus:border-pink-500 placeholder:text-slate-600 text-base ${!isMyTurn ? 'opacity-50' : ''}`}
             />
             <button 
                onClick={sendMessage} 
                disabled={!currentInput.trim() || !isMyTurn} 
                className={`p-3.5 rounded-full transition-all duration-200 ${
                    !currentInput.trim() || !isMyTurn
                    ? 'bg-slate-700 text-slate-500' 
                    : 'bg-pink-600 text-white shadow-lg shadow-pink-900/50 active:scale-90'
                }`}
             >
               <Send size={20} className={currentInput.trim() ? "ml-0.5" : ""} />
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineGame;