import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/Engine';
import { Crosshair, ShieldAlert, Target } from 'lucide-react';

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
    const [selectedTank, setSelectedTank] = useState<'light' | 'medium' | 'heavy'>('medium');
    const [uiState, setUiState] = useState({ health: 100, maxHealth: 100, reloadProgress: 1, score: 0, isPaused: false, ammo: 0, maxAmmo: 0 });

    useEffect(() => {
        if (gameState === 'playing' && canvasRef.current) {
            const engine = new GameEngine(canvasRef.current, selectedTank, (state) => {
                setUiState(state);
                if (state.health <= 0) {
                    setGameState('gameover');
                    engine.stop();
                }
            });
            engineRef.current = engine;
            engine.start();

            const handleResize = () => {
                if (canvasRef.current) {
                    canvasRef.current.width = window.innerWidth;
                    canvasRef.current.height = window.innerHeight;
                }
            };
            window.addEventListener('resize', handleResize);
            handleResize();

            return () => {
                engine.stop();
                window.removeEventListener('resize', handleResize);
            };
        }
    }, [gameState]);

    return (
        <div className="relative w-full h-screen bg-neutral-900 overflow-hidden font-sans text-white select-none">
            {gameState === 'playing' && (
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-crosshair" />
            )}

            {/* UI Overlay */}
            {gameState === 'playing' && (
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <div className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Score</div>
                            <div className="text-3xl font-mono font-bold text-emerald-400">{uiState.score}</div>
                        </div>
                        <div className="bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10 flex items-center gap-3">
                            <Target className="w-6 h-6 text-neutral-400" />
                            <div>
                                <div className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Armor Status</div>
                                <div className="w-48 h-4 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-200 ${uiState.health > 30 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        style={{ width: `${Math.max(0, (uiState.health / uiState.maxHealth) * 100)}%` }}
                                    />
                                </div>
                                <div className="text-xs text-right mt-1 text-neutral-300">{Math.ceil(uiState.health)} / {uiState.maxHealth}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center mb-8 gap-6">
                        <div className="bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10 flex items-center gap-4">
                            <Crosshair className={`w-6 h-6 ${uiState.reloadProgress >= 1 ? 'text-emerald-400' : 'text-orange-400 animate-pulse'}`} />
                            <div>
                                <div className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Main Gun</div>
                                <div className="w-64 h-3 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-orange-500 transition-all duration-75"
                                        style={{ width: `${uiState.reloadProgress * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10 flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Ammo</div>
                                <div className={`text-3xl font-mono font-bold ${uiState.ammo > 0 ? 'text-amber-400' : 'text-red-500 animate-bounce'}`}>
                                    {uiState.ammo} <span className="text-sm text-neutral-500">/ {uiState.maxAmmo}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Menus */}
            {gameState === 'menu' && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950">
                    <div className="text-center max-w-2xl p-8">
                        <ShieldAlert className="w-24 h-24 mx-auto text-emerald-500 mb-6" />
                        <h1 className="text-6xl font-black uppercase tracking-tighter mb-4 text-white drop-shadow-lg">Steel Vanguard</h1>
                        <p className="text-xl text-neutral-400 mb-8">Top-down armored warfare. Angle your hull to bounce shots, flank enemies for critical rear damage.</p>

                        <div className="grid grid-cols-2 gap-4 text-left bg-black/30 p-6 rounded-2xl mb-8 border border-white/5">
                            <div>
                                <h3 className="font-bold text-emerald-400 mb-2">Controls</h3>
                                <ul className="text-neutral-300 space-y-2 text-sm">
                                    <li><kbd className="bg-neutral-800 px-2 py-1 rounded">W</kbd> <kbd className="bg-neutral-800 px-2 py-1 rounded">S</kbd> Forward / Reverse</li>
                                    <li><kbd className="bg-neutral-800 px-2 py-1 rounded">A</kbd> <kbd className="bg-neutral-800 px-2 py-1 rounded">D</kbd> Rotate Hull</li>
                                    <li><kbd className="bg-neutral-800 px-2 py-1 rounded">Mouse</kbd> Aim Turret</li>
                                    <li><kbd className="bg-neutral-800 px-2 py-1 rounded">Click</kbd> Fire Main Gun</li>
                                    <li><kbd className="bg-neutral-800 px-2 py-1 rounded">ESC</kbd> Pause Game</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-bold text-orange-400 mb-2">Armor Mechanics</h3>
                                <ul className="text-neutral-300 space-y-2 text-sm">
                                    <li><span className="text-emerald-400 font-bold">Front:</span> Heavy Armor (Ricochet)</li>
                                    <li><span className="text-yellow-400 font-bold">Sides:</span> Medium Armor (Normal)</li>
                                    <li><span className="text-red-400 font-bold">Rear:</span> Weak Armor (Critical)</li>
                                </ul>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-white mb-4 uppercase tracking-wider">Select Your Vehicle</h3>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { id: 'light', name: 'Light Tank', speed: 'Fast', armor: 'Light', dmg: 'Low', color: 'text-blue-400', border: 'border-blue-500', bg: 'bg-blue-500/20' },
                                    { id: 'medium', name: 'Medium Tank', speed: 'Normal', armor: 'Medium', dmg: 'Normal', color: 'text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-500/20' },
                                    { id: 'heavy', name: 'Heavy Tank', speed: 'Slow', armor: 'Heavy', dmg: 'High', color: 'text-orange-400', border: 'border-orange-500', bg: 'bg-orange-500/20' }
                                ].map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => setSelectedTank(t.id as any)}
                                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-left ${selectedTank === t.id ? `${t.border} ${t.bg}` : 'border-white/10 bg-black/40 hover:border-white/30'}`}
                                    >
                                        <h4 className={`font-bold text-lg uppercase mb-2 ${t.color}`}>{t.name}</h4>
                                        <ul className="text-sm text-neutral-300 space-y-1">
                                            <li><span className="text-neutral-500">Speed:</span> {t.speed}</li>
                                            <li><span className="text-neutral-500">Armor:</span> {t.armor}</li>
                                            <li><span className="text-neutral-500">Damage:</span> {t.dmg}</li>
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => setGameState('playing')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(5,150,105,0.3)] pointer-events-auto"
                        >
                            DEPLOY TO BATTLE
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'gameover' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                    <div className="text-center">
                        <h2 className="text-6xl font-black uppercase tracking-tighter text-red-500 mb-4">Vehicle Destroyed</h2>
                        <p className="text-2xl text-neutral-300 mb-8">Final Score: <span className="text-emerald-400 font-mono font-bold">{uiState.score}</span></p>
                        <button
                            onClick={() => setGameState('playing')}
                            className="bg-white text-black font-bold text-xl py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 pointer-events-auto"
                        >
                            REDEPLOY
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'playing' && uiState.isPaused && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50">
                    <div className="text-center">
                        <h2 className="text-6xl font-black uppercase tracking-tighter text-white mb-8">PAUSED</h2>
                        <div className="flex flex-col gap-4 items-center">
                            <button
                                onClick={() => {
                                    if (engineRef.current) {
                                        engineRef.current.isPaused = false;
                                        engineRef.current.forceUIUpdate();
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(5,150,105,0.3)] pointer-events-auto w-64"
                            >
                                RESUME
                            </button>
                            <button
                                onClick={() => {
                                    setGameState('menu');
                                    if (engineRef.current) engineRef.current.stop();
                                }}
                                className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold text-lg py-3 px-8 rounded-full transition-all hover:scale-105 active:scale-95 pointer-events-auto w-64"
                            >
                                QUIT TO MENU
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
