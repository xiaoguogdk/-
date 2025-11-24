import React from 'react';
import { BallState } from '../types';

interface SimulationCanvasProps {
  ball1: BallState;
  ball2: BallState;
  trackLength: number;
}

export const SimulationCanvas: React.FC<SimulationCanvasProps> = ({ ball1, ball2, trackLength }) => {
  // Convert physical position (meters) to percentage for CSS positioning
  const getLeftPos = (pos: number) => {
    // Mapping 0 to trackLength meters to 0% - 100%
    const percentage = (pos / trackLength) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  // Dynamic visual sizing based on mass (clamped for visuals)
  const getSize = (mass: number) => Math.max(40, Math.min(100, 30 + mass * 10));

  return (
    <div className="w-full h-64 bg-slate-900/50 rounded-xl border border-slate-700 relative overflow-hidden shadow-inner flex items-center mb-6 backdrop-blur-sm select-none">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-20" 
           style={{ 
             backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
           }}>
      </div>

      {/* Track Line */}
      <div className="absolute w-full h-1 bg-slate-600 top-1/2 transform -translate-y-1/2"></div>
      
      {/* Distance Markers */}
      <div className="absolute w-full bottom-2 flex justify-between px-4 text-xs text-slate-500 font-mono">
        <span>0m</span>
        <span>{trackLength / 2}m</span>
        <span>{trackLength}m</span>
      </div>

      {/* Ball 1 */}
      <div 
        className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 will-change-transform flex flex-col items-center justify-center"
        style={{ left: `${getLeftPos(ball1.position)}%`, width: getSize(ball1.mass), height: getSize(ball1.mass) }}
      >
        <div className={`w-full h-full rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)] bg-gradient-to-br from-cyan-400 to-cyan-700 border-2 border-cyan-200 flex items-center justify-center text-slate-900 font-bold`}>
           1
        </div>
        <div className="absolute -top-8 text-cyan-400 font-mono text-xs whitespace-nowrap bg-slate-900/80 px-1 rounded border border-cyan-900">
          v={ball1.velocity.toFixed(2)}
        </div>
      </div>

      {/* Ball 2 */}
      <div 
        className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 will-change-transform flex flex-col items-center justify-center"
        style={{ left: `${getLeftPos(ball2.position)}%`, width: getSize(ball2.mass), height: getSize(ball2.mass) }}
      >
         <div className={`w-full h-full rounded-full shadow-[0_0_20px_rgba(217,70,239,0.6)] bg-gradient-to-br from-fuchsia-400 to-fuchsia-700 border-2 border-fuchsia-200 flex items-center justify-center text-slate-900 font-bold`}>
           2
        </div>
        <div className="absolute -top-8 text-fuchsia-400 font-mono text-xs whitespace-nowrap bg-slate-900/80 px-1 rounded border border-fuchsia-900">
          v={ball2.velocity.toFixed(2)}
        </div>
      </div>
    </div>
  );
};