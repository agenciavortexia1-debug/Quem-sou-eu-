import React, { useState, useEffect, useRef } from 'react';
import { peerService } from '../services/peerService';
import { AnswerType, NetworkPacket, PacketType, ChatMessage } from '../types';
import { ArrowLeft, Copy, Check, Send, AlertTriangle, User, RefreshCw, Trophy, Crown } from 'lucide-react';

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

const OnlineGame: React.FC<Props> = ({ isHost, onBack }) => {
  const [phase, setPhase] = useState<Phase>(Phase.CONNECTING);
  const [myId, setMyId] = useState<string>('');
  const [hostIdInput, setHostIdInput] = useState('');
  const [connectionError, setConnectionError] = useState('');
  
  // Game State
  const [myTargetCharacter, setMyTargetCharacter] = useState(''); // Who I defined (My opponent's character)
  const [mySecretIdentity, setMySecretIdentity] = useState('');   // Who I am (Defined by opponent)
  const [setupInput, setSetupInput] = useState('');
  const [isWaitingForOpponentSetup, setIsWaitingForOpponentSetup] = useState(false);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [pendingGuess, setPendingGuess] = useState<string | null>(null); // If opponent made a guess
  const [isGuessingMode, setIsGuessingMode] = useState(false);

  const [winner, setWinner] = useState<'me' | 'opponent' | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingGuess]);

  // Init Peer
  useEffect(() => {
    const init = async () => {
      try {
        const id = await peerService.initialize();
        setMyId(id);
        if (isHost) {
          setPhase(Phase.LOBBY);
        } else {
          setPhase(Phase.LOBBY); // Joiner sees input field
        }
      } catch (err) {
        setConnectionError('Falha ao conectar ao servidor de rede.');
      }
    };

    peerService.onConnectCallback = () => {
      setPhase(Phase.SETUP);
      // Host goes first by default
      setIsMyTurn(isHost);
    };

    peerService.onDataCallback = (packet: NetworkPacket) => {
      handlePacket(packet);
    };

    peerService.onCloseCallback = () => {
      setConnectionError('Oponente desconectado.');
      setPhase(Phase.CONNECTING); // Or error state
    };

    init();

    return () => {
      peerService.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  const handlePacket = (packet: NetworkPacket) => {
    switch (packet.type) {
      case PacketType.SETUP_CHARACTER:
        setMySecretIdentity(packet.payload);
        if (myTargetCharacter) {
           // Both ready (I already set theirs, they just set mine)
           setPhase(Phase.PLAYING);
        }
        break;
      
      case PacketType.QUESTION:
        setMessages(prev => [...prev, {
          sender: 'opponent',
          type: 'text',
          content: packet.payload,
          timestamp: Date.now()
        }]);
        // It's technically still opponent's turn until I answer
        break;

      case PacketType.ANSWER:
        setMessages(prev => [...prev, {
          sender: 'opponent',
          type: 'answer',
          content: packet.payload,
          answerType: packet.payload,
          timestamp: Date.now()
        }]);
        setIsMyTurn(true); // Turn passes back to me after they answer my question
        break;

      case PacketType.GUESS:
        setPendingGuess(packet.payload);
        break;

      case PacketType.GUESS_RESULT:
        const { correct, guess } = packet.payload;
        setMessages(prev => [...prev, {
          sender: 'opponent',
          type: 'guess',
          content: `Chutou: ${guess} - ${correct ? 'CORRETO!' : 'ERROU!'}`,
          timestamp: Date.now()
        }]);
        if (correct) {
          setWinner('opponent');
          setPhase(Phase.GAME_OVER);
        } else {
          setIsMyTurn(true); // I get turn back
        }
        break;
      
      case PacketType.RESTART:
        resetGame(false);
        break;
    }
  };

  const handleJoin = () => {
    if (!hostIdInput) return;
    peerService.connect(hostIdInput);
  };

  const submitCharacter = () => {
    if (!setupInput.trim()) return;
    setMyTargetCharacter(setupInput);
    peerService.send(PacketType.SETUP_CHARACTER, setupInput);
    
    if (mySecretIdentity) {
      // I received mine already, so we can start
      setPhase(Phase.PLAYING);
    } else {
      setIsWaitingForOpponentSetup(true);
    }
  };

  const sendQuestion = () => {
    if (!currentInput.trim()) return;
    
    if (isGuessingMode) {
      // Sending a Guess
      peerService.send(PacketType.GUESS, currentInput);
      setMessages(prev => [...prev, {
        sender: 'me',
        type: 'guess',
        content: `Eu chuto que sou: ${currentInput}`,
        timestamp: Date.now()
      }]);
      setIsMyTurn(false); // Wait for confirmation
    } else {
      // Sending a Question
      peerService.send(PacketType.QUESTION, currentInput);
      setMessages(prev => [...prev, {
        sender: 'me',
        type: 'text',
        content: currentInput,
        timestamp: Date.now()
      }]);
      setIsMyTurn(false); // Wait for answer
    }
    setCurrentInput('');
    setIsGuessingMode(false);
  };

  const sendAnswer = (answer: AnswerType) => {
    peerService.send(PacketType.ANSWER, answer);
    setMessages(prev => [...prev, {
      sender: 'me',
      type: 'answer',
      content: answer,
      answerType: answer,
      timestamp: Date.now()
    }]);
    setIsMyTurn(false); // Turn goes to opponent
  };

  const resolveGuess = (correct: boolean) => {
    peerService.send(PacketType.GUESS_RESULT, { correct, guess: pendingGuess });
    setPendingGuess(null);
    if (correct) {
      setWinner('me'); // I confirmed they are correct, so THEY win? No wait.
      // If I confirm THEY are correct, THEY win.
      // If winner is 'me', it means *I* won. If winner is 'opponent', *they* won.
      // Logic: I confirmed their guess. They won.
      setWinner('opponent');
      setPhase(Phase.GAME_OVER);
    } else {
      setIsMyTurn(true); // My turn now
    }
  };

  const resetGame = (sendSignal: boolean) => {
    if (sendSignal) peerService.send(PacketType.RESTART);
    setMessages([]);
    setMyTargetCharacter('');
    setMySecretIdentity('');
    setSetupInput('');
    setIsWaitingForOpponentSetup(false);
    setWinner(null);
    setPhase(Phase.SETUP);
    setIsMyTurn(isHost); // Host starts again
  };

  // --- RENDERERS ---

  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de Conexão</h2>
        <p className="text-slate-400 mb-6">{connectionError}</p>
        <button onClick={onBack} className="px-6 py-2 bg-slate-700 rounded-lg hover:bg-slate-600">Voltar</button>
      </div>
    );
  }

  if (phase === Phase.CONNECTING) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-indigo-300">Conectando ao servidor...</p>
      </div>
    );
  }

  if (phase === Phase.LOBBY) {
    return (
      <div className="max-w-md mx-auto w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl">
        <button onClick={onBack} className="mb-6 text-slate-400 hover:text-white flex items-center gap-2 text-sm"><ArrowLeft size={16}/> Voltar</button>
        
        {isHost ? (
          <div className="text-center">
             <h2 className="text-2xl font-bold text-white mb-2">Sua Sala</h2>
             <p className="text-slate-400 mb-6">Compartilhe este código com seu amigo:</p>
             
             <div className="flex items-center gap-2 bg-slate-950 p-4 rounded-xl border border-slate-700 mb-6">
                <code className="flex-1 text-xl font-mono text-indigo-400 tracking-wider">{myId}</code>
                <button 
                  onClick={() => navigator.clipboard.writeText(myId)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Copy size={20} className="text-slate-400" />
                </button>
             </div>
             
             <div className="flex items-center justify-center gap-3 text-slate-500 animate-pulse">
                <RefreshCw className="animate-spin" size={20} /> Aguardando oponente...
             </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Entrar na Sala</h2>
            <p className="text-slate-400 mb-6">Cole o código do seu amigo abaixo:</p>
            
            <input 
              value={hostIdInput}
              onChange={e => setHostIdInput(e.target.value)}
              placeholder="Código da Sala"
              className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white mb-4 focus:outline-none focus:border-indigo-500 font-mono text-center tracking-wider"
            />
            
            <button 
              onClick={handleJoin}
              disabled={!hostIdInput}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all"
            >
              Entrar
            </button>
          </div>
        )}
      </div>
    );
  }

  if (phase === Phase.SETUP) {
    return (
      <div className="max-w-lg mx-auto w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl text-center">
         <User className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
         <h2 className="text-2xl font-bold text-white mb-2">Defina o Personagem</h2>
         <p className="text-slate-400 mb-6">
           {isWaitingForOpponentSetup 
             ? "Aguardando o oponente escolher seu personagem..." 
             : "Escolha quem seu oponente será. Seja criativo!"}
         </p>

         {!isWaitingForOpponentSetup && (
           <>
            <input 
              value={setupInput}
              onChange={e => setSetupInput(e.target.value)}
              placeholder="Ex: Batman, Sua Sogra, Bob Esponja..."
              className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-white mb-4 focus:outline-none focus:border-indigo-500 text-center text-lg"
            />
            <button 
              onClick={submitCharacter}
              disabled={!setupInput.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all"
            >
              Confirmar e Jogar
            </button>
           </>
         )}
         
         {isWaitingForOpponentSetup && (
            <div className="mt-4 flex justify-center">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
         )}
      </div>
    );
  }

  if (phase === Phase.GAME_OVER) {
     const iWon = winner === 'me';
     return (
        <div className="max-w-md mx-auto w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-xl text-center animate-in zoom-in">
           {iWon ? (
             <>
               <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 animate-bounce" />
               <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 mb-4">Você Venceu!</h2>
               <p className="text-slate-300 text-lg mb-8">Você descobriu que era <strong>{mySecretIdentity}</strong>!</p>
             </>
           ) : (
             <>
               <Crown className="w-20 h-20 text-rose-400 mx-auto mb-4" />
               <h2 className="text-3xl font-bold text-white mb-4">Seu Oponente Venceu!</h2>
               <p className="text-slate-400 text-lg mb-8">Ele descobriu que era <strong>{myTargetCharacter}</strong>.</p>
             </>
           )}
           
           <button 
             onClick={() => resetGame(true)}
             className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold flex items-center justify-center gap-2 mx-auto transition-all hover:scale-105"
           >
             <RefreshCw size={20} /> Jogar Novamente
           </button>
        </div>
     );
  }

  // --- PLAYING PHASE ---
  
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative">
      
      {/* Header Info */}
      <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700 shrink-0">
         <div className="flex flex-col">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Oponente é:</span>
            <span className="text-indigo-400 font-bold text-lg truncate max-w-[150px] md:max-w-xs" title={myTargetCharacter}>
               {myTargetCharacter}
            </span>
         </div>
         
         <div className={`px-4 py-1 rounded-full text-sm font-bold border ${isMyTurn ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400 animate-pulse' : 'bg-rose-900/50 border-rose-500 text-rose-400'}`}>
            {isMyTurn ? 'Sua Vez' : 'Vez do Oponente'}
         </div>
         
         <button onClick={onBack} className="text-slate-500 hover:text-white p-2">
            <ArrowLeft size={20} />
         </button>
      </div>

      {/* Main Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
         {/* System Welcome */}
         <div className="text-center my-4">
            <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded-full">
              Jogo iniciado! Descubra quem você é fazendo perguntas de Sim/Não.
            </span>
         </div>

         {messages.map((msg, i) => (
           <div key={i} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                   msg.sender === 'me' 
                   ? 'bg-indigo-600 text-white rounded-tr-none' 
                   : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                } ${msg.type === 'guess' ? 'border-2 border-yellow-500/50' : ''}`}
              >
                 {msg.type === 'guess' && <span className="block text-xs opacity-70 mb-1 font-bold uppercase">Tentativa de Chute</span>}
                 {msg.content}
              </div>
           </div>
         ))}
      </div>

      {/* Action Area */}
      <div className="p-4 bg-slate-800 border-t border-slate-700 shrink-0">
         
         {pendingGuess ? (
            // Opponent made a guess, I must confirm
            <div className="animate-in slide-in-from-bottom duration-300">
               <div className="bg-slate-700 p-4 rounded-xl mb-2 text-center border border-yellow-500/50">
                  <h3 className="text-yellow-400 font-bold mb-1">Oponente chutou:</h3>
                  <p className="text-2xl text-white font-bold mb-4">"{pendingGuess}"</p>
                  <p className="text-slate-300 mb-4 text-sm">Isso está correto? (Se Sim, ele vence)</p>
                  <div className="flex gap-4 justify-center">
                     <button onClick={() => resolveGuess(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold flex gap-2"><Check /> Sim, Correto</button>
                     <button onClick={() => resolveGuess(false)} className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2 rounded-lg font-bold flex gap-2"><ArrowLeft /> Não, Errado</button>
                  </div>
               </div>
            </div>
         ) : !isMyTurn ? (
            // Receiving opponent question
            messages.length > 0 && messages[messages.length - 1].sender === 'opponent' && messages[messages.length - 1].type === 'text' ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {Object.values(AnswerType).map(ans => (
                      <button 
                        key={ans}
                        onClick={() => sendAnswer(ans)}
                        className="bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-medium transition-colors"
                      >
                        {ans}
                      </button>
                   ))}
                </div>
            ) : (
                // Just waiting
                <div className="text-center text-slate-500 py-4 flex items-center justify-center gap-2">
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                   Aguardando oponente...
                </div>
            )
         ) : (
            // My Turn
            <div className="flex flex-col gap-2">
               {isGuessingMode ? (
                  <div className="bg-yellow-900/20 border border-yellow-600/30 p-2 rounded-lg mb-2">
                     <p className="text-yellow-500 text-xs text-center font-bold">MODO DE CHUTE: Se você errar, passa a vez!</p>
                  </div>
               ) : null}
               
               <div className="flex gap-2">
                  <button 
                    onClick={() => setIsGuessingMode(!isGuessingMode)}
                    className={`p-3 rounded-xl transition-colors ${isGuessingMode ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    title="Tentar Adivinhar"
                  >
                     <Trophy size={20} />
                  </button>
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendQuestion()}
                    placeholder={isGuessingMode ? "Digite seu palpite final..." : "Faça uma pergunta de Sim/Não..."}
                    className={`flex-1 bg-slate-950 border ${isGuessingMode ? 'border-yellow-600 focus:ring-yellow-600' : 'border-slate-600 focus:ring-indigo-500'} text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition-all`}
                  />
                  <button
                    onClick={sendQuestion}
                    disabled={!currentInput.trim()}
                    className={`${isGuessingMode ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-50 text-white p-3 rounded-xl transition-all`}
                  >
                    <Send size={20} />
                  </button>
               </div>
            </div>
         )}
         
      </div>
    </div>
  );
};

export default OnlineGame;