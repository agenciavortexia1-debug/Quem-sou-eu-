import React from 'react';
import { GameMode } from '../types';
import { BrainCircuit, Radio, Users } from 'lucide-react';

interface Props {
  onSelectMode: (mode: GameMode) => void;
}

const GameModeSelection: React.FC<Props> = ({ onSelectMode }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-700">
      <div className="mb-10 text-center">
        <div className="inline-block p-4 mb-4 rounded-full bg-indigo-600/20 backdrop-blur-sm animate-float">
          <BrainCircuit className="w-16 h-16 text-indigo-400" />
        </div>
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">
          Quem Sou Eu?
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          Multiplayer Online. Conecte-se com um amigo e descubra quem você é!
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Host Card */}
        <button
          onClick={() => onSelectMode(GameMode.HOST)}
          className="group relative flex flex-col items-center p-8 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-indigo-500 transition-all duration-300 hover:scale-[1.02] shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Radio className="w-12 h-12 text-indigo-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Criar Sala</h2>
          <p className="text-slate-400 text-center">
            Gere um código e convide um amigo para jogar.
          </p>
        </button>

        {/* Join Card */}
        <button
          onClick={() => onSelectMode(GameMode.JOIN)}
          className="group relative flex flex-col items-center p-8 bg-slate-800/50 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-rose-500 transition-all duration-300 hover:scale-[1.02] shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-rose-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Users className="w-12 h-12 text-rose-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Entrar em Sala</h2>
          <p className="text-slate-400 text-center">
            Tem um código? Entre na sala do seu amigo.
          </p>
        </button>
      </div>
    </div>
  );
};

export default GameModeSelection;