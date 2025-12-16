import React, { useEffect, useRef, useState, useMemo } from 'react';
import { PatternConfig, ProcessedAsset, LayoutItem } from './types';
import { PatternEngine } from './services/patternEngine';
import AssetUploader from './components/AssetUploader';
import ColorPalette from './components/ColorPalette';

const DEFAULT_CONFIG: PatternConfig = {
  mode: 'random',
  density: 60,
  gridGap: 10,
  minSize: 40,
  maxSize: 120,
  rotationRandomness: true,
  colors: ['#000000'], // Default to Black
  useRandomColor: true,
  preventOverlap: true,
  useMask: false,
  showMaskBg: true,
  enableAnim: false,
  animAmplitude: 15,
  animSpeed: 20,
};

function App() {
  const [config, setConfig] = useState<PatternConfig>(DEFAULT_CONFIG);
  const [assets, setAssets] = useState<ProcessedAsset[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [layoutItems, setLayoutItems] = useState<LayoutItem[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);
  const engine = useMemo(() => new PatternEngine(), []);
  const animationRef = useRef<number>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- Initialization & Resize ---
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        // Handle high DPI
        const dpr = window.devicePixelRatio || 1;
        canvasRef.current.width = width * dpr;
        canvasRef.current.height = height * dpr;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            engine.setContext(ctx, width, height);
            generatePattern(); // Regenerate on resize
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial set
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // --- Update Engine Assets ---
  useEffect(() => {
    engine.setAssets(assets);
  }, [assets, engine]);

  // --- Real-time Generation ---
  // Trigger generation whenever config changes
  useEffect(() => {
    if (assets.length > 0) {
        generatePattern();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]); 

  // --- Animation Loop ---
  useEffect(() => {
    const loop = (time: number) => {
        engine.render(layoutItems, config, time);
        animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current!);
  }, [layoutItems, config, engine]);


  // --- Logic Actions ---
  const generatePattern = () => {
    const newItems = engine.generateLayout(config);
    setLayoutItems(newItems);
  };

  const handleAssetUpload = (fileList: FileList) => {
    const files = Array.from(fileList);
    const newAssets: ProcessedAsset[] = [];
    
    let processedCount = 0;
    
    files.forEach(file => {
        const isSvg = file.type.includes('svg');
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const result = e.target?.result as string;
            
            // Helper to finalize asset
            const finalize = (img: HTMLImageElement, vectorContent?: string, viewBox?: string) => {
                 newAssets.push({
                     id: Math.random().toString(36).substr(2, 9),
                     originalFile: file,
                     type: isSvg ? 'svg' : 'raster',
                     img,
                     aspectRatio: img.width / img.height,
                     vectorContent,
                     viewBox
                 });
                 processedCount++;
                 if (processedCount === files.length) {
                     setAssets(prev => [...prev, ...newAssets]);
                     // Auto generate is now handled by the config/asset useEffects, 
                     // but explicit call ensures first render if config hasn't changed
                     if (assets.length === 0) setTimeout(generatePattern, 100);
                 }
            };

            if (isSvg) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(result, "image/svg+xml");
                const svgEl = doc.documentElement;
                let viewBox = svgEl.getAttribute('viewBox');
                if (!viewBox) {
                    const w = svgEl.getAttribute('width') || '100';
                    const h = svgEl.getAttribute('height') || '100';
                    viewBox = `0 0 ${parseFloat(w)} ${parseFloat(h)}`;
                }
                const blob = new Blob([result], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => finalize(img, svgEl.innerHTML, viewBox || undefined);
                img.src = url;
            } else {
                const img = new Image();
                img.onload = () => finalize(img);
                img.src = result;
            }
        };
        
        if (isSvg) reader.readAsText(file);
        else reader.readAsDataURL(file);
    });
  };

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const handleMaskUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
              engine.setMask(img);
              setConfig(prev => ({ ...prev, useMask: true }));
              // generatePattern will be triggered by config change
          };
          img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  // --- Export / Recording ---
  const downloadImage = () => {
      if (!canvasRef.current) return;
      // Re-render one clear frame without animation offset for clean export
      engine.render(layoutItems, { ...config, enableAnim: false }, 0);
      const link = document.createElement('a');
      link.download = 'pattern-export.png';
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
  };

  const downloadSVG = () => {
      const svgString = engine.exportSVG(layoutItems);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = 'pattern-export.svg';
      link.href = URL.createObjectURL(blob);
      link.click();
  };

  const toggleRecording = () => {
      if (isRecording) {
          // Stop
          mediaRecorderRef.current?.stop();
          setIsRecording(false);
      } else {
          // Start
          if (!canvasRef.current) return;
          const stream = canvasRef.current.captureStream(60);
          // Try to support WebM first
          const mimeType = MediaRecorder.isTypeSupported("video/webm; codecs=vp9") 
              ? "video/webm; codecs=vp9" 
              : "video/webm";
          
          const recorder = new MediaRecorder(stream, { mimeType });
          chunksRef.current = [];
          
          recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          
          recorder.onstop = () => {
              const blob = new Blob(chunksRef.current, { type: "video/webm" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "pattern-animation.webm";
              a.click();
          };
          
          recorder.start();
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
          // Force animation on if it wasn't
          if (!config.enableAnim) setConfig(prev => ({...prev, enableAnim: true}));
      }
  };

  // --- UI Components ---
  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans text-slate-800">
      
      {/* --- Sidebar --- */}
      <aside 
        className={`
            fixed top-0 left-0 h-full bg-white/95 backdrop-blur-xl border-r border-slate-200 shadow-2xl z-50
            transition-all duration-300 ease-in-out w-80 flex flex-col
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex-1 overflow-y-auto p-5 space-y-8 scrollbar-hide">
            <header className="flex justify-between items-center">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Pattern Studio</h1>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </header>

            {/* Asset Section */}
            <section>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">图标素材</h3>
                <AssetUploader assets={assets} onUpload={handleAssetUpload} onRemove={removeAsset} />
            </section>

            {/* Mode & Config */}
            <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">参数配置</h3>
                
                {/* Mode Selector */}
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {['random', 'grid'].map(m => (
                        <button
                            key={m}
                            onClick={() => {
                                setConfig(prev => ({...prev, mode: m as any}));
                            }}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${config.mode === m ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {m === 'random' ? '随机分布' : '网格排列'}
                        </button>
                    ))}
                </div>

                {/* Common Sliders */}
                <div className="space-y-4">
                    {config.mode === 'random' ? (
                        <>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>最小尺寸</span><span>{config.minSize}px</span></div>
                                <input type="range" min="10" max="200" value={config.minSize} onChange={e => setConfig({...config, minSize: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>最大尺寸</span><span>{config.maxSize}px</span></div>
                                <input type="range" min="10" max="400" value={config.maxSize} onChange={e => setConfig({...config, maxSize: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>分布密度</span><span>{config.density}</span></div>
                                <input type="range" min="10" max="400" value={config.density} onChange={e => setConfig({...config, density: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                    <input type="checkbox" checked={config.preventOverlap} onChange={e => setConfig({...config, preventOverlap: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                                    <span className="text-sm text-slate-600">防止重叠</span>
                                </label>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Grid Mode Controls */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>图标尺寸</span><span>{config.maxSize}px</span></div>
                                <input type="range" min="10" max="400" value={config.maxSize} onChange={e => setConfig({...config, maxSize: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs"><span>网格间距</span><span>{config.gridGap}px</span></div>
                                <input type="range" min="-20" max="100" value={config.gridGap} onChange={e => setConfig({...config, gridGap: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                            </div>
                        </>
                    )}

                    {/* Rotation Control */}
                    <div className="space-y-1 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={config.rotationRandomness} 
                                onChange={e => setConfig({...config, rotationRandomness: e.target.checked})} 
                                className="rounded text-blue-600 focus:ring-blue-500" 
                            />
                            <span className="text-sm text-slate-600">
                                {config.mode === 'grid' ? '旋转图标 (90°)' : '随机旋转角度'}
                            </span>
                        </label>
                    </div>
                </div>
            </section>

             {/* Masking */}
             <section>
                 <div className="flex items-center justify-between mb-2">
                     <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">形状遮罩</h3>
                     <label className="text-xs text-blue-600 cursor-pointer hover:underline">
                         上传图片
                         <input type="file" ref={maskInputRef} className="hidden" accept="image/*" onChange={handleMaskUpload} />
                     </label>
                 </div>
                 <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={config.useMask} disabled={!engine['maskData']} onChange={e => setConfig({...config, useMask: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50" />
                        <span className={`text-sm ${engine['maskData'] ? 'text-slate-600' : 'text-slate-400'}`}>启用遮罩填充</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={config.showMaskBg} disabled={!config.useMask} onChange={e => setConfig({...config, showMaskBg: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50" />
                        <span className="text-sm text-slate-600">显示遮罩轮廓</span>
                    </label>
                 </div>
             </section>

            {/* Colors */}
            <section>
                <ColorPalette 
                    colors={config.colors} 
                    onChange={c => setConfig({...config, colors: c})} 
                    useRandomColor={config.useRandomColor}
                    onToggleRandom={v => setConfig({...config, useRandomColor: v})}
                />
            </section>

             {/* Animation */}
             <section className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={config.enableAnim} onChange={e => setConfig({...config, enableAnim: e.target.checked})} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-semibold text-slate-700">漂浮动画</span>
                    </label>
                </div>
                {config.enableAnim && (
                    <div className="space-y-3 pl-1">
                         <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-500"><span>浮动幅度</span></div>
                            <input type="range" min="1" max="50" value={config.animAmplitude} onChange={e => setConfig({...config, animAmplitude: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                        </div>
                         <div className="space-y-1">
                            <div className="flex justify-between text-xs text-slate-500"><span>运动速度</span></div>
                            <input type="range" min="1" max="100" value={config.animSpeed} onChange={e => setConfig({...config, animSpeed: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                        </div>
                    </div>
                )}
            </section>
        </div>
        
        {/* Sticky Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 z-10 shrink-0">
            <button 
                onClick={generatePattern}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-lg active:transform active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                重新生成
            </button>
        </div>
      </aside>

      {/* --- Main Area --- */}
      <main ref={containerRef} className="flex-1 relative h-full cursor-grab active:cursor-grabbing bg-slate-200">
        
        {/* Toggle Sidebar Button */}
        {!isSidebarOpen && (
             <button 
                onClick={() => setSidebarOpen(true)}
                className="absolute top-4 left-4 z-40 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-600 hover:text-blue-600 transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            </button>
        )}

        {/* Toolbar */}
        <div className="absolute top-4 right-4 z-40 flex gap-2">
            <button onClick={downloadImage} className="px-4 py-2 bg-white/90 backdrop-blur rounded-lg shadow-sm text-sm font-semibold hover:bg-white text-slate-700">
                保存 PNG
            </button>
            <button onClick={downloadSVG} className="px-4 py-2 bg-white/90 backdrop-blur rounded-lg shadow-sm text-sm font-semibold hover:bg-white text-slate-700">
                导出 SVG
            </button>
            <button 
                onClick={toggleRecording} 
                className={`
                    px-4 py-2 rounded-lg shadow-sm text-sm font-semibold flex items-center gap-2 transition-all
                    ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-white/90 text-slate-700 hover:bg-white'}
                `}
            >
                {isRecording ? (
                    <><span className="w-2 h-2 bg-white rounded-full animate-ping"/> 停止录制</>
                ) : (
                    '录制视频'
                )}
            </button>
        </div>

        {/* Canvas */}
        <canvas ref={canvasRef} className="block w-full h-full touch-none" />
        
        {/* Empty State / Prompt */}
        {layoutItems.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-xl shadow-xl text-center">
                     <p className="text-lg font-bold text-slate-700">准备就绪</p>
                     <p className="text-sm text-slate-500">请在左侧侧边栏上传素材以开始</p>
                 </div>
             </div>
        )}
      </main>
    </div>
  );
}

export default App;