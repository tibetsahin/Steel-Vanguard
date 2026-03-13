import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/Engine';
import { Crosshair, ShieldAlert, Target, Trophy, LogIn, LogOut, User as UserIcon, Volume2, VolumeX } from 'lucide-react';
import { 
    auth, 
    db, 
    googleProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    limit, 
    onSnapshot, 
    serverTimestamp,
    User
} from './firebase';
import { AudioManager } from './game/AudioManager';

export default function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    const [gameState, setGameState] = useState<'login' | 'menu' | 'playing' | 'gameover'>('login');
    const [selectedTank, setSelectedTank] = useState<'light' | 'medium' | 'heavy'>('medium');
    const [uiState, setUiState] = useState({ health: 100, maxHealth: 100, reloadProgress: 1, score: 0, isPaused: false, ammo: 0, maxAmmo: 0 });
    const [soundEnabled, setSoundEnabled] = useState(true);
    
    const [user, setUser] = useState<User | null>(null);
    const [leaderboard, setLeaderboard] = useState<{displayName: string, score: number}[]>([]);

    useEffect(() => {
        AudioManager.getInstance().setEnabled(soundEnabled);
    }, [soundEnabled]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (u && gameState === 'login') {
                setGameState('menu');
            }
        });

        const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
        const unsubscribeLeaderboard = onSnapshot(q, (snapshot) => {
            const scores = snapshot.docs.map(doc => doc.data() as { displayName: string, score: number });
            setLeaderboard(scores);
        });

        return () => {
            unsubscribeAuth();
            unsubscribeLeaderboard();
        };
    }, [gameState]);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed:", error);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            setGameState('login');
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    const submitScore = async (score: number) => {
        if (!user || score <= 0) return;
        try {
            await addDoc(collection(db, 'leaderboard'), {
                uid: user.uid,
                displayName: user.displayName || 'Anonymous Commander',
                score: score,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to submit score:", error);
        }
    };

    useEffect(() => {
        if (gameState === 'playing' && canvasRef.current) {
            const engine = new GameEngine(
                canvasRef.current, 
                selectedTank, 
                (state) => setUiState(state),
                (finalScore) => {
                    setGameState('gameover');
                    submitScore(finalScore);
                }
            );
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
                        
                        <div className="flex gap-4 items-start pointer-events-auto">
                            <button 
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className="bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10 text-neutral-400 hover:text-white transition-colors"
                            >
                                {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                            </button>

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
            {gameState === 'login' && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950">
                    <div className="text-center max-w-md w-full p-8 bg-black/40 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
                        <ShieldAlert className="w-20 h-20 mx-auto text-emerald-500 mb-6" />
                        <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 text-white drop-shadow-lg">NormalWAR</h1>
                        <p className="text-neutral-400 mb-8">Sign in to join the global leaderboard.</p>

                        <button
                            onClick={handleLogin}
                            className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold text-xl py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl"
                        >
                            <LogIn className="w-6 h-6" />
                            SIGN IN WITH GOOGLE
                        </button>
                        
                        <button
                            onClick={() => setGameState('menu')}
                            className="mt-4 text-neutral-500 hover:text-neutral-300 transition-colors text-sm uppercase tracking-widest font-bold"
                        >
                            Play as Guest
                        </button>
                    </div>
                </div>
            )}

            {gameState === 'menu' && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950 overflow-y-auto py-20">
                    <div className="text-center max-w-2xl p-8 w-full">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                {user ? (
                                    <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-emerald-500" referrerPolicy="no-referrer" />
                                ) : (
                                    <UserIcon className="w-10 h-10 text-neutral-500" />
                                )}
                                <div className="text-left">
                                    <div className="text-xs text-neutral-500 uppercase font-bold">Commander</div>
                                    <div className="text-emerald-400 font-mono font-bold">{user?.displayName || 'Guest'}</div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    className="text-neutral-500 hover:text-white transition-colors"
                                    title={soundEnabled ? "Mute Sound" : "Unmute Sound"}
                                >
                                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                </button>
                                {user && (
                                    <button onClick={handleLogout} className="text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-2 text-xs font-bold uppercase">
                                        <LogOut className="w-4 h-4" /> Sign Out
                                    </button>
                                )}
                            </div>
                        </div>

                        <ShieldAlert className="w-24 h-24 mx-auto text-emerald-500 mb-6" />
                        <h1 className="text-6xl font-black uppercase tracking-tighter mb-2 text-white drop-shadow-lg">NormalWAR</h1>
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
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(5,150,105,0.3)] pointer-events-auto mb-12"
                        >
                            DEPLOY TO BATTLE
                        </button>

                        {leaderboard.length > 0 && (
                            <div className="bg-black/40 rounded-2xl p-6 border border-white/10">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <Trophy className="text-yellow-400 w-6 h-6" />
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Top Commanders</h3>
                                </div>
                                <div className="space-y-2">
                                    {leaderboard.map((entry, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-black/30 px-4 py-2 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-neutral-500 font-mono w-4">{idx + 1}.</span>
                                                <span className="font-bold text-neutral-200">{entry.displayName}</span>
                                            </div>
                                            <span className="font-mono text-emerald-400 font-bold">{entry.score}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {gameState === 'gameover' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
                    <div className="text-center max-w-md w-full p-8">
                        <h2 className="text-6xl font-black uppercase tracking-tighter text-red-500 mb-4">Vehicle Destroyed</h2>
                        <p className="text-2xl text-neutral-300 mb-8">Final Score: <span className="text-emerald-400 font-mono font-bold">{uiState.score}</span></p>
                        
                        {!user && uiState.score > 0 && (
                            <div className="bg-orange-500/20 border border-orange-500/50 p-4 rounded-xl mb-8 text-sm text-orange-200">
                                Sign in to save your score to the leaderboard!
                            </div>
                        )}

                        {leaderboard.length > 0 && (
                            <div className="bg-black/40 rounded-2xl p-6 border border-white/10 mb-8 text-left">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <Trophy className="text-yellow-400 w-6 h-6" />
                                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Top Commanders</h3>
                                </div>
                                <div className="space-y-2">
                                    {leaderboard.slice(0, 5).map((entry, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-black/30 px-4 py-2 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-neutral-500 font-mono w-4">{idx + 1}.</span>
                                                <span className="font-bold text-neutral-200">{entry.displayName}</span>
                                            </div>
                                            <span className="font-mono text-emerald-400 font-bold">{entry.score}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setGameState('menu')}
                            className="bg-white text-black font-bold text-xl py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 pointer-events-auto"
                        >
                            BACK TO MENU
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
