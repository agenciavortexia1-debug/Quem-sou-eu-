import React, { useState, useEffect, useRef } from 'react';
import { peerService } from '../services/peerService';
import { AnswerType, NetworkPacket, PacketType, ChatMessage } from '../types';
import { ArrowLeft, Copy, Send, AlertTriangle, User, RefreshCw, Trophy, Crown, Check, Sparkles, ChevronLeft } from 'lucide-react';

interface Props {
  isHost: boolean;
  onBack: () => void;
}

enum Phase {
  CONNECTING = 'CONNECTING',
  LOBBY = 'LOBBY',
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

const normalizeString = (str: string) => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

// --- COMPONENTES AUXILIARES (Definidos fora para evitar re-montagem e perda de foco) ---

const CardWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div className="flex flex-col h-full justify-center px-4 md:px-0">
      <div className="w-full max-w-md mx-auto bg-slate-800 p-6 md:p-8 rounded-2xl border border-slate-700 shadow-xl">
          {children}
      </div>
  </div>
);

const OnlineGame: React.FC<Props> = ({ isHost, onBack }) => {
  // --- CONNECTION STATE ---
  const [phase, setPhase] = useState<Phase>(Phase.CONNECTING);
  const [myId, setMyId] = useState<string>('');
  const [hostIdInput, setHostIdInput] = useState('');
  const [connectionError, setConnectionError] = useState('');

  // --- GAME LOGIC STATE ---
  const [myCharacter, setMyCharacter] = useState('');           
  const [opponentCharacter, setOpponentCharacter] = useState(''); 
  
  const [setupInput, setSetupInput] = useState('');
  
  // Chat & Turnos
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false); 
  const [gameResult, setGameResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Ref para callbacks permite que o listener do PeerJS acesse o estado mais recente
  const handlePacketRef = useRef<(packet: NetworkPacket) => void>(() => {});

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, phase]); // Adicionado phase para garantir scroll ao entrar no jogo

  // Detector de Início de Jogo
  useEffect(() => {
    if (phase === Phase.SETUP && myCharacter && opponentCharacter) {
      setPhase(Phase.PLAYING);
      setIsMyTurn(isHost);
    }
  }, [phase, myCharacter, opponentCharacter, isHost]);

  // --- PACKET HANDLER (Atualiza a ref a cada render) ---
  useEffect(() => {
    handlePacketRef.current = (packet: NetworkPacket) => {
      switch (packet.type) {
        case PacketType.EXCHANGE_CHARACTER:
          // Evita loop infinito se o valor for o mesmo
          if (opponentCharacter === packet.payload) return;
          
          setOpponentCharacter(packet.payload);
          // Handshake de confirmação: se já escolhi o meu, reenvio para garantir que o oponente tenha
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
          break;

        case PacketType.ANSWER:
          setMessages(prev => [...prev, {
            sender: 'opponent',
            type: 'answer',
            content: packet.payload,
            timestamp: Date.now()
          }]);
          
          // Lógica de turno baseada na resposta
          const isNegative = packet.payload === AnswerType.NO || packet.payload === AnswerType.PROBABLY_NOT;
          if (isNegative) {
            setIsMyTurn(false); 
          } else {
            setIsMyTurn(true);
          }
          break;

        case PacketType.GAME_WON:
          setGameResult('DEFEAT');
          setPhase(Phase.GAME_OVER);
          break;

        case PacketType.RESTART:
          fullReset(false);
          break;
      }
    };
  }); // Sem array de dependências: roda todo render para atualizar a ref

  // --- PEER INITIALIZATION ---
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const id = await peerService.initialize();
        if (mounted) {
          setMyId(id);
          setPhase(Phase.LOBBY);
        }
      } catch (err) {
        if (mounted) {
          console.error(err);
          setConnectionError('Erro ao conectar ao servidor P2P.');
        }
      }
    };

    // Configura callbacks do serviço
    peerService.onConnectCallback = () => {
      if (mounted) setPhase(Phase.SETUP);
    };

    peerService.onDataCallback = (packet) => {
      // Chama a função da ref que tem acesso ao estado atual via closure do render
      if (mounted) handlePacketRef.current(packet);
    };

    peerService.onCloseCallback = () => {
      if (mounted) {
        setConnectionError('Conexão perdida.');
        setPhase(Phase.CONNECTING);
      }
    };

    init();

    return () => {
      mounted = false;
      peerService.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executa apenas na montagem

  // --- ACTIONS ---

  const handleJoin = () => {
    if (!hostIdInput) return;
    setConnectionError(''); // Limpa erros anteriores
    peerService.connect(hostIdInput);
  };

  const confirmMyCharacter = () => {
    if (!setupInput.trim()) return;
    setMyCharacter(setupInput);
    peerService.send(PacketType.EXCHANGE_CHARACTER, setupInput);
  };

  const resendCharacter = () => {
    if (myCharacter) peerService.send(PacketType.EXCHANGE_CHARACTER, myCharacter);
  };

  const sendMessage = () => {
    if (!currentInput.trim()) return;

    const guess = normalizeString(currentInput);
    const target = normalizeString(opponentCharacter);

    // Validação de vitória
    if (opponentCharacter && guess === target) {
      setGameResult('VICTORY');
      setPhase(Phase.GAME_OVER);
      peerService.send(PacketType.GAME_WON, null); 
      return;
    }

    peerService.send(PacketType.MESSAGE, currentInput);
    setMessages(prev => [...prev, {
      sender: 'me',
      type: 'text',
      content: currentInput,
      timestamp: Date.now()
    }]);
    
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

    const isNegative = ans === AnswerType.NO || ans === AnswerType.PROBABLY_NOT;
    if (isNegative) {
      setIsMyTurn(true);
    } else {
      setIsMyTurn(false); 
    }
  };

  const fullReset = (sendSignal: boolean) => {
    if (sendSignal) peerService.send(PacketType.RESTART);
    setMyCharacter('');
    setOpponentCharacter('');
    setSetupInput('');
    setMessages([]);
    setGameResult(null);
    setPhase(Phase.SETUP);
    setIsMyTurn(isHost);
  };

  // --- RENDER ---

  if (connectionError) return (
    <CardWrapper>
      <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-white mb-4 font-medium">{connectionError}</p>
        <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-xl w-full transition-colors">Voltar para o Menu</button>
      </div>
    </CardWrapper>
  );

  if (phase === Phase.CONNECTING) return (
    <div className="flex flex-col items-center justify-center h-full text-indigo-400">
      <div className="animate-spin w-12 h-12 border-4 border-current border-t-transparent rounded-full mb-4"></div>
      <p className="animate-pulse">Conectando aos servidores...</p>
    </div>
  );

  if (phase === Phase.LOBBY) return (
    <CardWrapper>
      <button onClick={onBack} className="mb-6 text-slate-400 flex items-center gap-2 hover:text-white transition-colors">
        <ArrowLeft size={20}/> Voltar
      </button>
      {isHost ? (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Código da Sala</h2>
          <p className="text-slate-400 text-sm mb-4">Envie este código para o seu oponente</p>
          <div className="flex bg-slate-950 p-4 rounded-xl border border-slate-700 mb-6 gap-2 items-center group relative overflow-hidden">
            <code className="flex-1 text-2xl font-mono text-indigo-400 tracking-wider relative z-10">{myId}</code>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(myId);
                // Feedback visual poderia ser adicionado aqui
              }} 
              className="p-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg transition-colors z-10"
              title="Copiar Código"
            >
              <Copy className="text-slate-300" size={20} />
            </button>
          </div>
          <div className="flex justify-center gap-2 text-slate-500 animate-pulse items-center bg-slate-900/50 py-2 rounded-lg">
            <RefreshCw className="animate-spin" size={16} /> Aguardando Oponente...
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Entrar na Arena</h2>
          <p className="text-slate-400 text-sm mb-6">Insira o código fornecido pelo Host</p>
          <input 
            value={hostIdInput} 
            onChange={e => setHostIdInput(e.target.value)} 
            placeholder="Cole o código aqui" 
            className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white mb-6 text-center font-mono text-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" 
          />
          <button 
            onClick={handleJoin} 
            disabled={!hostIdInput} 
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg transition-all active:scale-[0.98]"
          >
            Conectar
          </button>
        </div>
      )}
    </CardWrapper>
  );

  if (phase === Phase.SETUP) return (
    <CardWrapper>
      <div className="text-center">
        <div className="bg-slate-900/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700 shadow-inner">
           <User className="w-10 h-10 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Sua Identidade</h2>
        <p className="text-slate-400 mb-6 text-sm">Escolha quem o oponente vai tentar adivinhar.</p>
        
        {!myCharacter ? (
          <div className="space-y-4">
            <input 
              value={setupInput} 
              onChange={e => setSetupInput(e.target.value)} 
              placeholder="Ex: Homem Aranha" 
              className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white text-center text-lg placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all" 
              autoFocus
            />
            <button 
              onClick={confirmMyCharacter} 
              disabled={!setupInput.trim()} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98]"
            >
              Confirmar
            </button>
          </div>
        ) : (
          <div className="text-emerald-400 font-bold text-xl p-6 bg-emerald-900/20 rounded-xl mb-4 border border-emerald-500/50 animate-in zoom-in duration-300">
             {myCharacter}
          </div>
        )}

        <div className="mt-8 border-t border-slate-700 pt-6">
          {!opponentCharacter ? (
            <div className="flex flex-col items-center gap-3 text-slate-500 text-sm">
              <div className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full"></div>
              <span>Aguardando oponente escolher...</span>
              {myCharacter && (
                <button onClick={resendCharacter} className="text-xs text-indigo-400 hover:text-indigo-300 underline p-2 transition-colors">
                  Reenviar minha escolha
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold bg-emerald-950/40 p-3 rounded-lg border border-emerald-900/50 animate-in fade-in slide-in-from-bottom-2">
              <Check size={20} /> Oponente está pronto!
            </div>
          )}
        </div>
      </div>
    </CardWrapper>
  );

  if (phase === Phase.GAME_OVER) return (
    <div className="flex flex-col items-center justify-center h-full px-6 animate-in zoom-in duration-300">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center">
        {gameResult === 'VICTORY' ? (
          <>
            <div className="relative inline-block">
               <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 animate-pulse"></div>
               <Trophy className="relative z-10 w-24 h-24 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
            </div>
            
            <h2 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 mb-2 tracking-tight">
              VITÓRIA!
            </h2>
            <p className="text-slate-400 mb-8 font-medium">Você descobriu a identidade secreta!</p>
            
            <div className="relative mb-10 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-slate-900 border border-yellow-500/30 p-6 rounded-xl shadow-xl">
                 <p className="text-xs text-yellow-500/70 uppercase tracking-[0.2em] mb-2 font-bold">Oponente era</p>
                 <div className="text-3xl font-black text-yellow-100 tracking-wide uppercase break-words drop-shadow-md">
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

            <h2 className="text-3xl font-bold text-white mb-2">DERROTA</h2>
            <p className="text-slate-400 mb-8">Ele descobriu quem era antes de você.</p>
            
            <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-700 mb-10 shadow-inner">
               <p className="text-xs text-slate-500 uppercase tracking-[0.2em] mb-2 font-bold flex items-center justify-center gap-2">
                 <Sparkles size={12} /> O personagem dele era
               </p>
               <div className="text-2xl font-bold text-indigo-300 tracking-wide uppercase break-words">
                 {opponentCharacter}
               </div>
            </div>
          </>
        )}
        <button 
          onClick={() => fullReset(true)} 
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
        >
          <RefreshCw size={20} /> 
          Jogar Novamente
        </button>
      </div>
    </div>
  );

  // --- PLAYING (FULL SCREEN MOBILE UI) ---
  return (
    <div className="flex flex-col h-full w-full bg-slate-900 md:rounded-xl md:overflow-hidden md:border md:border-slate-800 md:shadow-2xl md:h-[calc(100vh-80px)] md:max-w-4xl">
      {/* HEADER - Sticky Mobile */}
      <div className="bg-slate-800 p-2 md:p-3 grid grid-cols-[1fr_auto_1fr] items-center border-b border-slate-700 shrink-0 pt-safe z-10">
        
        {/* Left: Me */}
        <div className="flex flex-col items-start min-w-0">
          <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full max-w-[140px]">
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-tight">Você é</p>
            <p className="text-emerald-400 font-bold truncate text-sm" title={myCharacter}>{myCharacter}</p>
          </div>
        </div>

        {/* Center: Turn Status */}
        <div className="px-2">
          <div className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border whitespace-nowrap shadow-sm ${isMyTurn ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400 animate-pulse' : 'bg-rose-900/30 border-rose-500 text-rose-400'}`}>
            {isMyTurn ? 'SUA VEZ' : 'ESPERE'}
          </div>
        </div>

        {/* Right: Opponent */}
        <div className="flex flex-col items-end min-w-0">
           <div className="bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50 w-full max-w-[140px] text-right">
            <p className="text-[10px] text-slate-500 uppercase font-bold leading-tight">Alvo</p>
            <p className="text-slate-400 font-mono tracking-widest text-sm leading-none">?????</p>
          </div>
        </div>
      </div>

      {/* CHAT AREA */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-slate-900/50 overscroll-contain">
        <div className="flex justify-center my-4">
           <span className="text-[10px] md:text-xs text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50">
             Descubra quem é seu alvo. Digite o nome para vencer!
           </span>
        </div>
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm md:text-base shadow-sm break-words ${
              msg.sender === 'me' 
                ? (msg.type === 'answer' ? 'bg-indigo-900 text-indigo-100 border border-indigo-700/50' : 'bg-indigo-600 text-white') 
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

      {/* INPUT AREA - Safe Area Bottom */}
      <div className="p-3 bg-slate-800 border-t border-slate-700 pb-safe">
        
        {/* ANSWER MODE */}
        {!isMyTurn && messages.length > 0 && messages[messages.length-1].sender === 'opponent' && messages[messages.length-1].type === 'text' ? (
          <div className="animate-in slide-in-from-bottom-4 duration-300">
            <p className="text-xs text-slate-400 text-center mb-2 font-medium">Responda a pergunta:</p>
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
          /* QUESTION / GUESS MODE */
          <div className="flex gap-2 items-center">
             <input 
               value={currentInput}
               onChange={e => setCurrentInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && sendMessage()}
               placeholder="Perguntar ou Adivinhar..."
               className="flex-1 bg-slate-950 border border-slate-600 text-white px-4 py-3.5 rounded-full focus:outline-none focus:border-indigo-500 placeholder:text-slate-600 text-base"
             />
             <button 
                onClick={sendMessage} 
                disabled={!currentInput.trim()} 
                className={`p-3.5 rounded-full transition-all duration-200 ${
                    !currentInput.trim() 
                    ? 'bg-slate-700 text-slate-500' 
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50 active:scale-90'
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