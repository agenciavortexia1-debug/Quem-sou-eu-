import React, { useState } from 'react';
import { GameMode } from './types';
import GameModeSelection from './components/GameModeSelection';
import OnlineGame from './components/OnlineGame';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);

  return (
    <div className="h-[100dvh] w-screen bg-[#0f172a] text-slate-200 selection:bg-orange-500/30 overflow-hidden flex flex-col">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-900/20 blur-[80px] md:blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-900/20 blur-[80px] md:blur-[100px]" />
      </div>

      {/* Main Container - Full size on mobile, Centered on Desktop */}
      <div className="relative z-10 w-full h-full flex flex-col md:items-center md:justify-center md:container md:mx-auto md:px-4 md:py-8">
        
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