import React from 'react';
import { GameMode } from '../types';
import { Swords, Radio, Users, Flame } from 'lucide-react';

interface Props {
  onSelectMode: (mode: GameMode) => void;
}

const GameModeSelection: React.FC<Props> = ({ onSelectMode }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-6 overflow-y-auto pt-safe pb-safe animate-in fade-in duration-700">
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-lg">
        <div className="mb-8 md:mb-10 text-center">
          <div className="inline-block p-4 mb-4 rounded-full bg-orange-600/20 backdrop-blur-sm animate-float shadow-[0_0_20px_rgba(234,88,12,0.3)]">
            <Swords className="w-12 h-12 md:w-16 md:h-16 text-orange-500" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-500 to-rose-600 mb-6 tracking-tighter drop-shadow-sm uppercase leading-tight">
            Quem Sou Eu?
          </h1>
          
          <div className="relative group w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900/80 border border-orange-500/30 p-4 md:p-6 rounded-xl shadow-2xl backdrop-blur-md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg whitespace-nowrap">
                Desafio Supremo
              </div>
              <p className="text-orange-100 text-lg md:text-xl font-bold uppercase tracking-wide leading-relaxed text-center">
                TUY VS RICK <br/>
                <span className="text-xs md:text-sm font-normal text-orange-300 normal-case block mt-1">Quem perder deve um beijinho <span className="text-lg md:text-2xl align-middle">👩‍❤️‍👨</span></span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full">
          {/* Host Card */}
          <button
            onClick={() => onSelectMode(GameMode.HOST)}
            className="group relative flex flex-row md:flex-col items-center p-6 bg-slate-800/60 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-orange-500 active:scale-[0.98] transition-all duration-300 shadow-xl touch-manipulation"
          >
            <div className="absolute inset-0 bg-gradient-to-r md:bg-gradient-to-br from-orange-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Radio className="w-8 h-8 md:w-12 md:h-12 text-orange-400 mr-4 md:mr-0 md:mb-4 shrink-0" />
            <div className="text-left md:text-center">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Criar Arena</h2>
              <p className="text-sm text-slate-400 leading-snug">
                Gere o código e desafie.
              </p>
            </div>
          </button>

          {/* Join Card */}
          <button
            onClick={() => onSelectMode(GameMode.JOIN)}
            className="group relative flex flex-row md:flex-col items-center p-6 bg-slate-800/60 border border-slate-700 rounded-2xl hover:bg-slate-800 hover:border-red-500 active:scale-[0.98] transition-all duration-300 shadow-xl touch-manipulation"
          >
            <div className="absolute inset-0 bg-gradient-to-r md:bg-gradient-to-br from-red-600/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Flame className="w-8 h-8 md:w-12 md:h-12 text-red-400 mr-4 md:mr-0 md:mb-4 shrink-0" />
            <div className="text-left md:text-center">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Entrar</h2>
              <p className="text-sm text-slate-400 leading-snug">
                Tem o código? Batalhe!
              </p>
            </div>
          </button>
        </div>
      </div>
      <div className="text-xs text-slate-600 py-4 pb-safe">v1.0 Mobile Edition</div>
    </div>
  );
};

export default GameModeSelection;