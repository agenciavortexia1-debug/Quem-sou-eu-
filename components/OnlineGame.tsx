import React, { useState, useEffect, useRef } from 'react';
import { peerService } from '../services/peerService';
import { AnswerType, NetworkPacket, PacketType, ChatMessage } from '../types';
import { ArrowLeft, Copy, Send, AlertTriangle, User, RefreshCw, Trophy, Crown, RefreshCcw, HelpCircle, Eye, EyeOff, ShieldQuestion, Check, Sparkles } from 'lucide-react';

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

const OnlineGame: React.FC<Props> = ({ isHost, onBack }) => {
  // --- CONNECTION STATE ---
  const [phase, setPhase] = useState<Phase>(Phase.CONNECTING);
  const [myId, setMyId] = useState<string>('');
  const [hostIdInput, setHostIdInput] = useState('');
  const [connectionError, setConnectionError] = useState('');

  // --- GAME LOGIC STATE ---
  const [myCharacter, setMyCharacter] = useState('');           // Quem EU sou (Eu defini)
  const [opponentCharacter, setOpponentCharacter] = useState(''); // Quem ELE é (Ele definiu, fica oculto pra mim)
  
  const [setupInput, setSetupInput] = useState('');
  
  // Chat & Turnos
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false); // Controle visual de turno
  const [gameResult, setGameResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const handlePacketRef = useRef<(packet: NetworkPacket) => void>(() => {});

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Detector de Início de Jogo
  useEffect(() => {
    if (phase === Phase.SETUP && myCharacter && opponentCharacter) {
      setPhase(Phase.PLAYING);
      // Host começa perguntando
      setIsMyTurn(isHost);
    }
  }, [phase, myCharacter, opponentCharacter, isHost]);

  // --- PACKET HANDLER ---
  useEffect(() => {
    handlePacketRef.current = (packet: NetworkPacket) => {
      switch (packet.type) {
        case PacketType.EXCHANGE_CHARACTER:
          // Recebi o personagem do oponente.
          // Guardo no estado para validar vitórias, mas NÃO mostro na UI (fica oculto visualmente).
          if (opponentCharacter === packet.payload) return;
          console.log("Personagem do oponente recebido para validação:", packet.payload);
          setOpponentCharacter(packet.payload);
          
          // Se eu já escolhi o meu, reenvio para garantir sincronia (Handshake)
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
          // Se recebi uma pergunta, agora tenho que responder.
          // Turno visual muda para mim (responder).
          break;

        case PacketType.ANSWER:
          setMessages(prev => [...prev, {
            sender: 'opponent',
            type: 'answer',
            content: packet.payload,
            timestamp: Date.now()
          }]);
          
          // Lógica de Turno Simplificada:
          // Se recebi "Não" ou "Provavelmente não", perco a vez.
          const isNegative = packet.payload === AnswerType.NO || packet.payload === AnswerType.PROBABLY_NOT;
          if (isNegative) {
            setIsMyTurn(false); 
          } else {
            setIsMyTurn(true);
          }
          break;

        case PacketType.GAME_WON:
          // Oponente disse que ganhou (ele acertou meu personagem). Logo, eu perdi.
          setGameResult('DEFEAT');
          setPhase(Phase.GAME_OVER);
          break;

        case PacketType.RESTART:
          fullReset(false);
          break;
      }
    };
  });

  // --- PEER INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      try {
        const id = await peerService.initialize();
        setMyId(id);
        setPhase(Phase.LOBBY);
      } catch (err) {
        setConnectionError('Erro na conexão P2P.');
      }
    };

    peerService.onConnectCallback = () => {
      setPhase(Phase.SETUP);
    };

    peerService.onDataCallback = (packet) => handlePacketRef.current(packet);

    peerService.onCloseCallback = () => {
      setConnectionError('Oponente desconectou.');
      setPhase(Phase.CONNECTING);
    };

    init();
    return () => peerService.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- ACTIONS ---

  const handleJoin = () => {
    if (!hostIdInput) return;
    peerService.connect(hostIdInput);
  };

  const confirmMyCharacter = () => {
    if (!setupInput.trim()) return;
    setMyCharacter(setupInput);
    // Envio meu personagem para o oponente guardar (para validação dele)
    peerService.send(PacketType.EXCHANGE_CHARACTER, setupInput);
  };

  const resendCharacter = () => {
    if (myCharacter) peerService.send(PacketType.EXCHANGE_CHARACTER, myCharacter);
  };

  const sendMessage = () => {
    if (!currentInput.trim()) return;

    // --- LÓGICA DE VALIDAÇÃO AUTOMÁTICA DE VITÓRIA ---
    // Normalizamos ambas as strings (remove acentos, espaços, minúsculas)
    const guess = normalizeString(currentInput);
    const target = normalizeString(opponentCharacter);

    // Se o que eu digitei bate com o personagem oculto do oponente:
    if (opponentCharacter && guess === target) {
      // 1. Defino minha vitória localmente
      setGameResult('VICTORY');
      setPhase(Phase.GAME_OVER);
      
      // 2. Aviso o oponente que o jogo acabou (ele perdeu)
      peerService.send(PacketType.GAME_WON, null); 
      return;
    }

    // Se não for vitória, envia mensagem normal
    peerService.send(PacketType.MESSAGE, currentInput);
    setMessages(prev => [...prev, {
      sender: 'me',
      type: 'text',
      content: currentInput,
      timestamp: Date.now()
    }]);
    
    // Perco a vez de interagir enquanto espero resposta
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

    // Se respondi "Não", ganho a vez de perguntar.
    const isNegative = ans === AnswerType.NO || ans === AnswerType.PROBABLY_NOT;
    if (isNegative) {
      setIsMyTurn(true);
    } else {
      setIsMyTurn(false); // Continuo respondendo
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
    <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      <p className="text-white mb-4">{connectionError}</p>
      <button onClick={onBack} className="bg-slate-700 px-4 py-2 rounded">Voltar</button>
    </div>
  );

  if (phase === Phase.CONNECTING) return (
    <div className="flex flex-col items-center justify-center h-96 text-indigo-400">
      <div className="animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full mb-4"></div>
      Carregando...
    </div>
  );

  if (phase === Phase.LOBBY) return (
    <div className="max-w-md mx-auto bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl">
      <button onClick={onBack} className="mb-6 text-slate-400 flex items-center gap-2"><ArrowLeft size={16}/> Voltar</button>
      {isHost ? (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Código da Sala</h2>
          <div className="flex bg-slate-950 p-4 rounded-xl border border-slate-700 mb-6 gap-2">
            <code className="flex-1 text-xl font-mono text-indigo-400">{myId}</code>
            <button onClick={() => navigator.clipboard.writeText(myId)}><Copy className="text-slate-400" /></button>
          </div>
          <div className="flex justify-center gap-2 text-slate-500 animate-pulse"><RefreshCw className="animate-spin" /> Esperando Oponente...</div>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Entrar</h2>
          <input value={hostIdInput} onChange={e => setHostIdInput(e.target.value)} placeholder="Cole o código aqui" className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white mb-4 text-center font-mono" />
          <button onClick={handleJoin} disabled={!hostIdInput} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl">Conectar</button>
        </div>
      )}
    </div>
  );

  if (phase === Phase.SETUP) return (
    <div className="max-w-lg mx-auto bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl text-center">
      <User className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-white mb-2">Quem você vai ser?</h2>
      <p className="text-slate-400 mb-6">Escolha o personagem que o oponente terá que adivinhar.</p>
      
      {!myCharacter ? (
        <>
          <input value={setupInput} onChange={e => setSetupInput(e.target.value)} placeholder="Ex: Homem Aranha" className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white mb-4 text-center text-lg" />
          <button onClick={confirmMyCharacter} disabled={!setupInput.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl">Confirmar</button>
        </>
      ) : (
        <div className="text-emerald-400 font-bold text-xl p-4 bg-emerald-900/20 rounded-xl mb-4 border border-emerald-500/50">
          Você é: {myCharacter}
        </div>
      )}

      <div className="mt-6 border-t border-slate-700 pt-6">
        {!opponentCharacter ? (
          <div className="flex flex-col items-center gap-2 text-slate-500">
            <div className="animate-spin w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full"></div>
            Aguardando oponente escolher...
            <button onClick={resendCharacter} className="text-xs text-indigo-400 underline">Reenviar meu status</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold">
            <Check size={20} /> Oponente está pronto!
          </div>
        )}
      </div>
    </div>
  );

  if (phase === Phase.GAME_OVER) return (
    <div className="max-w-md mx-auto bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center animate-in zoom-in duration-500">
      {gameResult === 'VICTORY' ? (
        <>
          <div className="relative inline-block">
             <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 animate-pulse"></div>
             <Trophy className="relative z-10 w-24 h-24 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
          </div>
          
          <h2 className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 mb-2 tracking-tight">
            VITÓRIA!
          </h2>
          <p className="text-slate-400 mb-8 font-medium">Você descobriu a identidade secreta:</p>
          
          <div className="relative mb-10 group">
            <div className="absolute -inset-1 bg-gradient-to-r from-yellow-600 to-amber-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900 border border-yellow-500/30 p-6 rounded-xl shadow-xl">
               <p className="text-xs text-yellow-500/70 uppercase tracking-[0.2em] mb-2 font-bold">Oponente era</p>
               <div className="text-4xl md:text-5xl font-black text-yellow-100 tracking-wide uppercase break-words drop-shadow-md">
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
             <div className="text-3xl md:text-4xl font-bold text-indigo-300 tracking-wide uppercase break-words">
               {opponentCharacter}
             </div>
          </div>
        </>
      )}
      <button 
        onClick={() => fullReset(true)} 
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
      >
        <RefreshCw size={20} /> 
        Jogar Novamente
      </button>
    </div>
  );

  // --- PLAYING ---
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* HEADER */}
      <div className="bg-slate-800 p-3 grid grid-cols-3 items-center border-b border-slate-700 shrink-0">
        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Você é</p>
          <p className="text-emerald-400 font-bold truncate max-w-[120px]" title={myCharacter}>{myCharacter}</p>
        </div>

        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${isMyTurn ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-rose-900/30 border-rose-500 text-rose-400'}`}>
            {isMyTurn ? 'Sua Vez' : 'Vez do Oponente'}
          </div>
        </div>

        <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Oponente é</p>
          <p className="text-slate-500 font-mono tracking-widest text-lg leading-none">*****</p>
        </div>
      </div>

      {/* CHAT */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        <p className="text-center text-xs text-slate-500 py-2 bg-slate-800/50 rounded-full mx-auto w-fit px-4">
          Para vencer, digite o <strong>nome do personagem</strong> no chat!
        </p>
        
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              msg.sender === 'me' 
                ? (msg.type === 'answer' ? 'bg-indigo-900 text-indigo-100 border border-indigo-700' : 'bg-indigo-600 text-white') 
                : (msg.type === 'answer' ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-700 text-white')
            } ${msg.sender === 'me' ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER INPUT */}
      <div className="p-3 bg-slate-800 border-t border-slate-700">
        
        {/* MODO DE RESPOSTA (Se a ultima msg foi pergunta do oponente) */}
        {!isMyTurn && messages.length > 0 && messages[messages.length-1].sender === 'opponent' && messages[messages.length-1].type === 'text' ? (
          <div>
            <p className="text-xs text-slate-400 text-center mb-2">Responda a pergunta do oponente:</p>
            <div className="grid grid-cols-3 gap-2">
              {[AnswerType.YES, AnswerType.NO, AnswerType.DONT_KNOW, AnswerType.MAYBE, AnswerType.PROBABLY, AnswerType.PROBABLY_NOT].map(ans => (
                <button key={ans} onClick={() => sendAnswer(ans)} className={`py-2 px-1 rounded text-xs font-bold transition-colors ${
                  (ans === AnswerType.NO || ans === AnswerType.PROBABLY_NOT) 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                  : 'bg-slate-600 hover:bg-slate-500 text-white'
                }`}>
                  {ans}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* MODO DE PERGUNTA */
          <div className="flex gap-2">
             <input 
               value={currentInput}
               onChange={e => setCurrentInput(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && sendMessage()}
               placeholder="Pergunte ou digite o NOME EXATO para vencer..."
               className="flex-1 bg-slate-950 border border-slate-600 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
             />
             <button onClick={sendMessage} disabled={!currentInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl">
               <Send size={20} />
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnlineGame;