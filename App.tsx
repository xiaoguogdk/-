import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SimulationCanvas } from './components/SimulationCanvas';
import { analyzeCollision } from './services/geminiService';
import { BallState, SimulationDataPoint, AnalysisStatus } from './types';

// Icons
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>;
const RotateCcwIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>;
const BrainCircuitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path><path d="M15 13a4.5 4.5 0 0 1-3-1.4 4.5 4.5 0 0 1-3 1.4"></path><path d="M12 13v9"></path><path d="M12 22h4"></path><path d="M12 22H8"></path></svg>;

const TRACK_LENGTH = 10; // meters
const FPS = 60;

const App: React.FC = () => {
  // --- State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [elasticity, setElasticity] = useState(1); // 1 = elastic, 0 = inelastic
  
  // Ball State
  const [ball1, setBall1] = useState<BallState>({ id: 1, mass: 2, velocity: 3, position: 2, color: 'cyan', radius: 0.5 });
  const [ball2, setBall2] = useState<BallState>({ id: 2, mass: 2, velocity: -2, position: 8, color: 'fuchsia', radius: 0.5 });

  // History for charts
  const [dataHistory, setDataHistory] = useState<SimulationDataPoint[]>([]);
  
  // AI Analysis State
  const [analysis, setAnalysis] = useState<string>("");
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [initialStateSnapshot, setInitialStateSnapshot] = useState<{p: number, ke: number} | null>(null);

  // Refs for loop
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();
  const lastChartUpdateRef = useRef<number>(0); // Throttling charts
  const ballsRef = useRef({ b1: ball1, b2: ball2 }); // Mutable ref for physics loop to avoid closure staleness

  // Sync state to ref when user changes inputs while paused
  useEffect(() => {
    if (!isPlaying) {
      ballsRef.current = { b1: ball1, b2: ball2 };
    }
  }, [ball1, ball2, isPlaying]);

  // --- Physics Logic ---
  const calculatePhysics = (dt: number) => {
    let { b1, b2 } = ballsRef.current;
    
    // Update positions
    let nextPos1 = b1.position + b1.velocity * dt;
    let nextPos2 = b2.position + b2.velocity * dt;
    
    // Check Wall Collisions (Elastic for walls)
    if (nextPos1 <= 0) {
      nextPos1 = 0;
      b1.velocity *= -1;
    }
    if (nextPos2 >= TRACK_LENGTH) {
      nextPos2 = TRACK_LENGTH;
      b2.velocity *= -1;
    }

    // Ball Collision
    // If b1 is on left and b2 on right, collision happens when pos1 >= pos2
    if (nextPos1 >= nextPos2 - 0.1) { 
      const m1 = b1.mass;
      const m2 = b2.mass;
      const v1 = b1.velocity;
      const v2 = b2.velocity;
      const e = elasticity;

      // Calculate new velocities
      const newV1 = ((m1 - e * m2) * v1 + (1 + e) * m2 * v2) / (m1 + m2);
      const newV2 = ((1 + e) * m1 * v1 + (m2 - e * m1) * v2) / (m1 + m2);

      b1.velocity = newV1;
      b2.velocity = newV2;
      
      // Separate them slightly to prevent sticking
      const midPoint = (nextPos1 + nextPos2) / 2;
      nextPos1 = midPoint - 0.06;
      nextPos2 = midPoint + 0.06;
    }

    // Apply updates
    b1.position = nextPos1;
    b2.position = nextPos2;

    ballsRef.current = { b1, b2 };
    
    // Sync to React State
    setBall1({...b1});
    setBall2({...b2});
  };

  const updateCharts = (currentTime: number) => {
    const { b1, b2 } = ballsRef.current;
    const p1 = b1.mass * b1.velocity;
    const p2 = b2.mass * b2.velocity;
    const ke1 = 0.5 * b1.mass * b1.velocity ** 2;
    const ke2 = 0.5 * b2.mass * b2.velocity ** 2;

    const newData: SimulationDataPoint = {
      time: parseFloat(currentTime.toFixed(2)), 
      v1: parseFloat(b1.velocity.toFixed(2)),
      v2: parseFloat(b2.velocity.toFixed(2)),
      totalMomentum: parseFloat((p1 + p2).toFixed(2)),
      totalKineticEnergy: parseFloat((ke1 + ke2).toFixed(2)),
    };

    setDataHistory(prev => {
      const newHist = [...prev, newData];
      if (newHist.length > 80) return newHist.slice(newHist.length - 80); // Keep last 80 points
      return newHist;
    });
  };

  const animate = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = (timestamp - lastTimeRef.current) / 1000; // seconds
    lastTimeRef.current = timestamp;

    // Cap dt to avoid huge jumps if tab inactive
    const safeDt = Math.min(deltaTime, 0.1);

    calculatePhysics(safeDt);
    
    // Update time state (triggers simple re-renders for time display)
    setTime(prev => prev + safeDt);

    // Optimization: Only update charts every 100ms (10fps) to prevent Recharts lag from blocking the UI thread
    // This keeps the ball animation (running at 60fps via setBall state) smooth.
    if (timestamp - lastChartUpdateRef.current > 100) {
      updateCharts(ballsRef.current.b1.position / ballsRef.current.b1.velocity * 0 + (lastTimeRef.current || 0)); // Just passing a dummy value or relying on state isn't ideal, let's use state derived time
      // Actually, we can't easily access the 'new' time state here inside the callback loop without refs.
      // Let's just use a running time ref if we really cared about precision, but for this, we'll just assume linear time.
      // For simplicity, we'll pass the approximate accumulated time.
      // However, 'time' state is async. Let's just use the current `time` + accumulated `safeDt` in logic, 
      // but `updateCharts` needs the value. We'll just let it be slightly detached or use a ref for total time.
      updateCharts(Date.now()); // Temporary placeholder, let's fix the time passing logic below.
      lastChartUpdateRef.current = timestamp;
    }
    
    requestRef.current = requestAnimationFrame(animate);
  };

  // Better Time Tracking for Charts
  const totalTimeRef = useRef(0);
  
  const animateOptimized = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = (timestamp - lastTimeRef.current) / 1000;
    lastTimeRef.current = timestamp;
    
    const safeDt = Math.min(deltaTime, 0.1);
    
    calculatePhysics(safeDt);
    totalTimeRef.current += safeDt;
    setTime(totalTimeRef.current);

    // Update charts at 15 FPS
    if (timestamp - lastChartUpdateRef.current > 66) {
      updateCharts(totalTimeRef.current);
      lastChartUpdateRef.current = timestamp;
    }

    requestRef.current = requestAnimationFrame(animateOptimized);
  };


  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animateOptimized);
    } else {
      lastTimeRef.current = undefined;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const handleReset = () => {
    setIsPlaying(false);
    setTime(0);
    totalTimeRef.current = 0;
    setBall1({ ...ball1, position: 2, velocity: 3 });
    setBall2({ ...ball2, position: 8, velocity: -2 });
    ballsRef.current = {
      b1: { ...ball1, position: 2, velocity: 3 },
      b2: { ...ball2, position: 8, velocity: -2 }
    };
    setDataHistory([]);
    setAnalysis("");
    setAnalysisStatus(AnalysisStatus.IDLE);
    setInitialStateSnapshot(null);
  };

  const togglePlay = () => {
    if (!isPlaying) {
       if (dataHistory.length === 0) {
         const p = ball1.mass * ball1.velocity + ball2.mass * ball2.velocity;
         const ke = 0.5 * ball1.mass * ball1.velocity**2 + 0.5 * ball2.mass * ball2.velocity**2;
         setInitialStateSnapshot({ p, ke });
       }
    }
    setIsPlaying(!isPlaying);
  };

  const handleAIAnalyze = async () => {
    if (!initialStateSnapshot) return;

    setAnalysisStatus(AnalysisStatus.LOADING);
    const finalP = ball1.mass * ball1.velocity + ball2.mass * ball2.velocity;
    const finalKE = 0.5 * ball1.mass * ball1.velocity**2 + 0.5 * ball2.mass * ball2.velocity**2;
    
    const result = await analyzeCollision(
      ball1, 
      ball2, 
      elasticity, 
      initialStateSnapshot, 
      { p: finalP, ke: finalKE }
    );
    
    setAnalysis(result);
    setAnalysisStatus(AnalysisStatus.SUCCESS);
  };

  // --- Calculations for Display ---
  const p1 = ball1.mass * ball1.velocity;
  const p2 = ball2.mass * ball2.velocity;
  const totalP = p1 + p2;
  const totalKE = 0.5 * ball1.mass * ball1.velocity ** 2 + 0.5 * ball2.mass * ball2.velocity ** 2;

  return (
    <div className="min-h-screen bg-cyber-dark text-slate-200 p-4 md:p-8 font-sans selection:bg-cyan-500/30">
      <header className="mb-8 flex justify-between items-center border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-400">
            NeonMomentum: 霓虹动量
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI 驱动的高中物理实验室</p>
        </div>
        <div className="flex gap-2">
           <button className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-400 hover:text-white transition">实验教程</button>
           <button className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-400 hover:text-white transition">设置</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Simulation Area */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-cyber-panel rounded-2xl p-6 shadow-xl border border-slate-700/50">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                 实验演示区
              </h2>
              <div className="text-slate-400 font-mono text-sm">时间: {time.toFixed(2)}s</div>
            </div>
            
            <SimulationCanvas ball1={ball1} ball2={ball2} trackLength={TRACK_LENGTH} />

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={togglePlay}
                className={`flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all shadow-lg hover:shadow-cyan-500/20 ${isPlaying ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'}`}
              >
                {isPlaying ? <><PauseIcon /> 暂停</> : <><PlayIcon /> 开始实验</>}
              </button>
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition-all"
              >
                <RotateCcwIcon /> 重置
              </button>
            </div>
          </section>

          {/* Real-time Charts */}
          <section className="bg-cyber-panel rounded-2xl p-6 shadow-xl border border-slate-700/50 h-96">
             <h2 className="text-xl font-semibold text-fuchsia-400 mb-4">实时数据监控</h2>
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={dataHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" stroke="#94a3b8" label={{ value: '时间 (s)', position: 'insideBottomRight', offset: -5, fill: '#94a3b8' }} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    labelFormatter={(t) => `时间: ${t}s`}
                  />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Line type="monotone" dataKey="v1" stroke="#22d3ee" name="速度 1 (m/s)" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="v2" stroke="#d946ef" name="速度 2 (m/s)" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="totalMomentum" stroke="#f59e0b" name="总动量 (kg·m/s)" dot={false} strokeDasharray="5 5" isAnimationActive={false} />
               </LineChart>
             </ResponsiveContainer>
          </section>
        </div>

        {/* Controls & AI Side Panel */}
        <div className="space-y-6">
          
          {/* Controls */}
          <section className="bg-cyber-panel rounded-2xl p-6 shadow-xl border border-slate-700/50">
             <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">实验参数设置</h3>
             
             {/* Ball 1 Config */}
             <div className="mb-6 space-y-3">
               <div className="flex justify-between items-center">
                  <span className="text-cyan-400 font-bold">小球 1 (青色)</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 uppercase">质量 (kg)</label>
                    <input 
                      type="number" 
                      value={ball1.mass} 
                      onChange={(e) => setBall1({...ball1, mass: parseFloat(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:border-cyan-500 outline-none"
                      disabled={isPlaying}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase">初速度 (m/s)</label>
                    <input 
                      type="number" 
                      value={ball1.velocity} 
                      onChange={(e) => setBall1({...ball1, velocity: parseFloat(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:border-cyan-500 outline-none"
                      disabled={isPlaying}
                    />
                  </div>
               </div>
             </div>

             {/* Ball 2 Config */}
             <div className="mb-6 space-y-3">
               <div className="flex justify-between items-center">
                  <span className="text-fuchsia-400 font-bold">小球 2 (紫色)</span>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 uppercase">质量 (kg)</label>
                    <input 
                      type="number" 
                      value={ball2.mass} 
                      onChange={(e) => setBall2({...ball2, mass: parseFloat(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:border-fuchsia-500 outline-none"
                      disabled={isPlaying}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase">初速度 (m/s)</label>
                    <input 
                      type="number" 
                      value={ball2.velocity} 
                      onChange={(e) => setBall2({...ball2, velocity: parseFloat(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white focus:border-fuchsia-500 outline-none"
                      disabled={isPlaying}
                    />
                  </div>
               </div>
             </div>

             {/* Global Config */}
             <div>
                <label className="text-xs text-slate-500 uppercase block mb-1">
                  碰撞弹性系数 (e): {elasticity}
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={elasticity} 
                  onChange={(e) => setElasticity(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  disabled={isPlaying}
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>完全非弹性 (0)</span>
                  <span>完全弹性 (1)</span>
                </div>
             </div>
          </section>

          {/* Stats Summary */}
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
               <div className="text-slate-500 text-xs uppercase">系统总动量</div>
               <div className="text-xl font-mono text-white">{totalP.toFixed(2)}</div>
               <div className="text-xs text-slate-600">kg·m/s</div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
               <div className="text-slate-500 text-xs uppercase">系统总动能</div>
               <div className="text-xl font-mono text-white">{totalKE.toFixed(2)}</div>
               <div className="text-xs text-slate-600">J (焦耳)</div>
            </div>
          </section>

          {/* AI Analysis */}
          <section className="bg-gradient-to-b from-indigo-900/40 to-slate-900/40 rounded-2xl p-6 shadow-xl border border-indigo-500/30">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-indigo-300 flex items-center gap-2">
                 <BrainCircuitIcon /> Gemini 智能分析
               </h3>
               {analysisStatus !== AnalysisStatus.LOADING && (
                 <button 
                   onClick={handleAIAnalyze}
                   disabled={!initialStateSnapshot}
                   className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   生成分析报告
                 </button>
               )}
             </div>
             
             <div className="min-h-[150px] text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-lg border border-slate-800 overflow-y-auto max-h-60 custom-scrollbar">
                {analysisStatus === AnalysisStatus.IDLE && (
                  <p className="text-slate-500 italic">请点击“开始实验”，等待小球碰撞发生后，点击上方按钮获取 AI 物理老师的点评。</p>
                )}
                {analysisStatus === AnalysisStatus.LOADING && (
                  <div className="flex items-center gap-2 text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-75"></span>
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce delay-150"></span>
                    AI 正在思考物理原理...
                  </div>
                )}
                {analysisStatus === AnalysisStatus.SUCCESS && (
                  <div className="markdown-prose">
                    {analysis.split('\n').map((line, i) => (
                      <p key={i} className="mb-2">{line}</p>
                    ))}
                  </div>
                )}
                 {analysisStatus === AnalysisStatus.ERROR && (
                  <p className="text-red-400">分析失败，请检查网络设置。</p>
                )}
             </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default App;