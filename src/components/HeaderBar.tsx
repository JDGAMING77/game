import React from 'react';
import { Volume2, VolumeX, Download, Maximize, Minimize, HelpCircle, Gamepad2 } from 'lucide-react';
import { sound } from '../game/audio';

interface HeaderBarProps {
  isMuted: boolean;
  isFullscreen: boolean;
  onToggleSound: () => void;
  onOpenControls: () => void;
  onToggleFullscreen: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isMuted,
  isFullscreen,
  onToggleSound,
  onOpenControls,
  onToggleFullscreen
}) => {
  const handleDownload = () => {
    // Download the single self-contained HTML file
    const link = document.createElement('a');
    link.href = '/jiro-speed-adventure.html';
    link.download = 'jiro-speed-adventure.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between z-30 shrink-0 select-none transition-all">
      {/* Brand Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-orange-500/20 shrink-0">
          <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950" />
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-1.5 sm:gap-2">
            <span>JIRO</span>
            <span className="hidden xs:inline">: SPEED ADVENTURE</span>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest bg-cyan-500/20 text-cyan-400 px-1.5 sm:px-2 py-0.5 rounded-full border border-cyan-500/30">
              HTML5
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 hidden md:block">Original 2D Fast-Paced Platformer</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Download Standalone Single-File Button */}
        <button
          onClick={handleDownload}
          title="Save as standalone single-file jiro-speed-adventure.html"
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Save</span> HTML
        </button>

        {/* Audio Toggle */}
        <button
          onClick={onToggleSound}
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className={`p-1.5 sm:p-2 rounded-lg border transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            isMuted
              ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'
              : 'bg-slate-800 text-cyan-400 border-cyan-500/40 hover:bg-slate-700'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Controls Help */}
        <button
          onClick={onOpenControls}
          title="View Keyboard Controls"
          className="p-1.5 sm:p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all hover:bg-slate-700 cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className={`p-1.5 sm:p-2 rounded-lg border transition-all text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
            isFullscreen
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
