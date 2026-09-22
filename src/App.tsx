import { useState, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { GameCanvas } from './components/GameCanvas';
import { ControlsModal } from './components/ControlsModal';
import { sound } from './game/audio';

export default function App() {
  const [isMuted, setIsMuted] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  const handleToggleSound = useCallback(() => {
    sound.init();
    setIsMuted(prev => !prev);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <HeaderBar
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onOpenControls={() => setIsControlsOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
      />

      <main className="flex-1 w-full min-h-0 flex items-center justify-center overflow-hidden bg-slate-950">
        <GameCanvas isMuted={isMuted} onToggleSound={handleToggleSound} />
      </main>

      <ControlsModal
        isOpen={isControlsOpen}
        onClose={() => setIsControlsOpen(false)}
      />
    </div>
  );
}
