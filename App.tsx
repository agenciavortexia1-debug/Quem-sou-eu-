import React, { useState } from 'react';
import { GameMode } from './types';
import GameModeSelection from './components/GameModeSelection';
import OnlineGame from './components/OnlineGame';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-indigo-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[100px]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12 flex flex-col items-center justify-center min-h-screen">
        
        {mode === GameMode.MENU && (
          <GameModeSelection onSelectMode={setMode} />
        )}

        {(mode === GameMode.HOST || mode === GameMode.JOIN) && (
          <OnlineGame 
            isHost={mode === GameMode.HOST} 
            onBack={() => setMode(GameMode.MENU)} 
          />
        )}

      </div>
    </div>
  );
};

export default App;