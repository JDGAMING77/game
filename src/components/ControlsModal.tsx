import React from 'react';
import { X, ArrowLeft, ArrowRight, ArrowUp, Pause, RotateCcw, Volume2 } from 'lucide-react';

interface ControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ControlsModal: React.FC<ControlsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-black text-white tracking-wide mb-1 flex items-center gap-2">
          🎮 Game Controls & Guide
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Jiro: Speed Adventure — Fast-paced 2D platformer with momentum physics
        </p>

        <div className="space-y-2.5 mb-6 text-sm">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-700 text-cyan-300 font-mono text-xs rounded-md font-bold">A</span>
              <span className="text-xs text-slate-400">or</span>
              <span className="px-2.5 py-1 bg-slate-700 text-cyan-300 font-mono text-xs rounded-md font-bold flex items-center">
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
            </div>
            <span className="font-semibold text-slate-200">Move Left</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-700 text-cyan-300 font-mono text-xs rounded-md font-bold">D</span>
              <span className="text-xs text-slate-400">or</span>
              <span className="px-2.5 py-1 bg-slate-700 text-cyan-300 font-mono text-xs rounded-md font-bold flex items-center">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <span className="font-semibold text-slate-200">Move Right</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-700 text-amber-300 font-mono text-xs rounded-md font-bold">SPACE</span>
              <span className="text-xs text-slate-400">or</span>
              <span className="px-2 py-1 bg-slate-700 text-amber-300 font-mono text-xs rounded-md font-bold">W</span>
              <span className="text-xs text-slate-400">or</span>
              <span className="px-2.5 py-1 bg-slate-700 text-amber-300 font-mono text-xs rounded-md font-bold flex items-center">
                <ArrowUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <span className="font-semibold text-slate-200">Jump (Hold for higher jump)</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="px-3 py-1 bg-slate-700 text-purple-300 font-mono text-xs rounded-md font-bold flex items-center gap-1">
              <Pause className="w-3 h-3" /> P
            </span>
            <span className="font-semibold text-slate-200">Pause / Resume</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="px-3 py-1 bg-slate-700 text-rose-300 font-mono text-xs rounded-md font-bold flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> R
            </span>
            <span className="font-semibold text-slate-200">Restart Level (on Game Over)</span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <span className="px-3 py-1 bg-slate-700 text-emerald-300 font-mono text-xs rounded-md font-bold flex items-center gap-1">
              <Volume2 className="w-3 h-3" /> M
            </span>
            <span className="font-semibold text-slate-200">Toggle Sound FX</span>
          </div>
        </div>

        {/* Tips & Scoring */}
        <div className="p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-xl mb-5 space-y-1">
          <p className="text-xs font-bold text-cyan-300">⭐ SCORING & PRO TIPS</p>
          <ul className="text-xs text-cyan-100/90 list-disc list-inside space-y-0.5">
            <li><strong>Coin</strong> = +100 points</li>
            <li><strong>Stomp Enemy</strong> = +250 points &amp; upward spring bounce</li>
            <li><strong>Finish Flag</strong> = +1,000 points + speed time bonus</li>
            <li>Touching enemies or falling into pits loses 1 Life (start with 3 lives).</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 font-bold text-white rounded-xl transition"
        >
          Got it, let's run!
        </button>
      </div>
    </div>
  );
};
