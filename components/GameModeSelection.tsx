import React from 'react';
import { PlayerProfile } from '../types';
import { Heart, Stars } from 'lucide-react';

interface Props {
  onSelectProfile: (profile: PlayerProfile) => void;
}

const GameModeSelection: React.FC<Props> = ({ onSelectProfile }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-6 overflow-y-auto pt-safe pb-safe animate-in fade-in duration-700">
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-lg">
        <div className="mb-8 md:mb-10 text-center relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="inline-block p-4 mb-4 rounded-full bg-pink-600/20 backdrop-blur-sm shadow-[0_0_20px_rgba(236,72,153,0.3)] animate-float">
            <Heart className="w-12 h-12 md:w-16 md:h-16 text-pink-500 fill-pink-500/50" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-500 to-red-600 mb-2 tracking-tighter drop-shadow-sm uppercase leading-tight">
            Quem Sou Eu?
          </h1>
          <p className="text-pink-200/70 font-medium tracking-widest text-sm uppercase">Edição Especial Tuy & Rick</p>
        </div>

        <div className="w-full bg-slate-800/50 backdrop-blur-md border border-pink-500/20 p-6 rounded-2xl shadow-2xl mb-8">
            <p className="text-center text-slate-300 mb-6 font-medium">Quem vai jogar agora?</p>
            
            <div className="grid grid-cols-1 gap-4">
            {/* TUY Selection */}
            <button
                onClick={() => onSelectProfile('TUY')}
                className="group relative flex items-center p-4 bg-gradient-to-r from-pink-900/40 to-slate-800 border border-pink-500/30 rounded-xl hover:border-pink-400 active:scale-[0.98] transition-all duration-300 shadow-lg"
            >
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mr-4 border border-pink-500/50 group-hover:bg-pink-500/40 transition-colors">
                    <span className="text-2xl">👩🏻‍🦰</span>
                </div>
                <div className="text-left flex-1">
                <h2 className="text-xl font-bold text-white group-hover:text-pink-300 transition-colors">Sou a TUY</h2>
                <p className="text-xs text-slate-400">Vou escolher quem o Rick é.</p>
                </div>
                <Stars className="w-5 h-5 text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* RICK Selection */}
            <button
                onClick={() => onSelectProfile('RICK')}
                className="group relative flex items-center p-4 bg-gradient-to-r from-blue-900/40 to-slate-800 border border-blue-500/30 rounded-xl hover:border-blue-400 active:scale-[0.98] transition-all duration-300 shadow-lg"
            >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mr-4 border border-blue-500/50 group-hover:bg-blue-500/40 transition-colors">
                    <span className="text-2xl">🧔🏻‍♂️</span>
                </div>
                <div className="text-left flex-1">
                <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">Sou o RICK</h2>
                <p className="text-xs text-slate-400">Vou escolher quem a Tuy é.</p>
                </div>
                <Stars className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            </div>
        </div>
        
        <div className="text-center space-y-2">
             <div className="inline-block px-4 py-1 rounded-full bg-red-900/30 border border-red-500/20">
                <p className="text-xs text-red-300">Quem perder deve um beijinho 😘</p>
             </div>
        </div>
      </div>
    </div>
  );
};

export default GameModeSelection;