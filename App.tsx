import React, { useState } from 'react';
import { GameMode, PlayerProfile } from './types';
import GameModeSelection from './components/GameModeSelection';
import OnlineGame from './components/OnlineGame';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.SELECTION);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  const handleProfileSelect = (selectedProfile: PlayerProfile) => {
    setProfile(selectedProfile);
    setMode(GameMode.PLAYING);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#0f172a] text-slate-200 selection:bg-pink-500/30 overflow-hidden flex flex-col">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-pink-900/20 blur-[80px] md:blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[80px] md:blur-[100px]" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full h-full flex flex-col md:items-center md:justify-center md:container md:mx-auto md:px-4 md:py-8">
        
        {mode === GameMode.SELECTION && (
          <GameModeSelection onSelectProfile={handleProfileSelect} />
        )}

        {mode === GameMode.PLAYING && profile && (
          <OnlineGame 
            myProfile={profile} 
            onBack={() => {
                setMode(GameMode.SELECTION);
                setProfile(null);
            }} 
          />
        )}

      </div>
    </div>
  );
};

export default App;