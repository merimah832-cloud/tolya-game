import { useEffect, useRef, useState, useCallback } from 'react';
import { Skull, Play, RotateCcw, User } from 'lucide-react';
import { TolyaImage, BedImage, TreeObject, WinImage } from './components/GameAssets';

// Game Constants
const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const MOVEMENT_SPEED = 5;
const GROUND_HEIGHT = 50; // pixels from bottom
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const TOLYA_WIDTH = 40;
const TOLYA_HEIGHT = 60;
const BED_WIDTH = 60;
const BASE_BED_HEIGHT = 40;
const GIANT_BED_HEIGHT = 250; // Impossible to jump over (Tolya jump ~150px)
const OBSTACLE_SPEED = 5;
const WIN_SCORE = 50;

type GameState = 'menu' | 'playing' | 'won' | 'lost';
type LossReason = 'normal' | 'giant_bed';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TolyaState extends GameObject {
  vy: number;
  isJumping: boolean;
  direction: 'left' | 'right';
}

interface Obstacle extends GameObject {
  id: number;
  passed: boolean;
  variant: number;
  isGiant: boolean;
}

interface BackgroundObj extends GameObject {
  id: number;
  type: number;
}

export function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [lossReason, setLossReason] = useState<LossReason>('normal');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // Refs for game loop
  const requestRef = useRef<number>(0);
  const scoreRef = useRef(0);
  
  // Game entities state
  const [tolya, setTolya] = useState<TolyaState>({
    x: 50,
    y: 0, 
    width: TOLYA_WIDTH,
    height: TOLYA_HEIGHT,
    vy: 0,
    isJumping: false,
    direction: 'right'
  });
  
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [bgObjects, setBgObjects] = useState<BackgroundObj[]>([]);
  
  // Refs for mutable state access inside loop
  const tolyaRef = useRef<TolyaState>({
    x: 50,
    y: 0,
    width: TOLYA_WIDTH,
    height: TOLYA_HEIGHT,
    vy: 0,
    isJumping: false,
    direction: 'right'
  });
  const obstaclesRef = useRef<Obstacle[]>([]);
  const bgObjectsRef = useRef<BackgroundObj[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const frameCount = useRef<number>(0);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const startGame = () => {
    setGameState('playing');
    setLossReason('normal');
    setScore(0);
    scoreRef.current = 0;
    frameCount.current = 0;
    
    // Reset Tolya
    const startY = GAME_HEIGHT - GROUND_HEIGHT - TOLYA_HEIGHT;
    const initialTolya = {
      x: 50,
      y: startY,
      width: TOLYA_WIDTH,
      height: TOLYA_HEIGHT,
      vy: 0,
      isJumping: false,
      direction: 'right' as const
    };
    setTolya(initialTolya);
    tolyaRef.current = initialTolya;
    
    // Reset Obstacles
    setObstacles([]);
    obstaclesRef.current = [];
    
    // Start Loop
    cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const gameLoop = useCallback(() => {
    if (scoreRef.current >= WIN_SCORE) {
      setGameState('won');
      return;
    }

    updatePhysics();
    
    // Sync refs to state for rendering
    setTolya({ ...tolyaRef.current });
    setObstacles([...obstaclesRef.current]);
    setBgObjects([...bgObjectsRef.current]);
    
    requestRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const updatePhysics = () => {
    const tolya = tolyaRef.current;
    
    // Horizontal Movement
    if (keysPressed.current['ArrowRight']) {
      tolya.x += MOVEMENT_SPEED;
      tolya.direction = 'right';
    }
    if (keysPressed.current['ArrowLeft']) {
      tolya.x -= MOVEMENT_SPEED;
      tolya.direction = 'left';
    }

    // Boundary Checks (Horizontal)
    if (tolya.x < 0) tolya.x = 0;
    if (tolya.x + tolya.width > GAME_WIDTH) tolya.x = GAME_WIDTH - tolya.width;

    // Jumping
    if ((keysPressed.current['ArrowUp'] || keysPressed.current['Space']) && !tolya.isJumping) {
      tolya.vy = JUMP_FORCE;
      tolya.isJumping = true;
    }

    // Vertical Physics
    tolya.y += tolya.vy;
    tolya.vy += GRAVITY;

    const groundY = GAME_HEIGHT - GROUND_HEIGHT - TOLYA_HEIGHT;
    
    // Ground Collision
    if (tolya.y >= groundY) {
      tolya.y = groundY;
      tolya.vy = 0;
      tolya.isJumping = false;
    }

    // Spawn Obstacles logic
    frameCount.current++;
    const minSpawnTime = 60; // minimum frames between spawns
    // Chance increases slightly as score increases? Not requested but good for gameplay.
    // 1% chance per frame after minSpawnTime passes.
    if (frameCount.current > minSpawnTime && Math.random() < 0.02) {
      const isGiant = Math.random() < 0.01; // 1% chance for giant bed
      
      // Random height logic: Base + Random(0-20)
      const randomHeightAdd = Math.floor(Math.random() * 20);
      const height = isGiant ? GIANT_BED_HEIGHT : (BASE_BED_HEIGHT + randomHeightAdd);
      
      const obstacle: Obstacle = {
        x: GAME_WIDTH,
        y: GAME_HEIGHT - GROUND_HEIGHT - height, 
        width: BED_WIDTH,
        height: height,
        id: Date.now(),
        passed: false,
        variant: Math.floor(Math.random() * 3),
        isGiant: isGiant
      };
      obstaclesRef.current.push(obstacle);
      frameCount.current = 0;
    }

    // Spawn Background Objects (Trees)
    if (Math.random() < 0.01) {
       const scale = 0.5 + Math.random() * 0.5;
       const bgObj: BackgroundObj = {
         x: GAME_WIDTH,
         y: GAME_HEIGHT - GROUND_HEIGHT - (100 * scale) + 10, // Slightly buried
         width: 100 * scale,
         height: 100 * scale,
         id: Date.now() + Math.random(),
         type: Math.floor(Math.random() * 2)
       };
       bgObjectsRef.current.push(bgObj);
    }

    // Update Background Objects
    bgObjectsRef.current.forEach(obj => {
      obj.x -= OBSTACLE_SPEED * 0.5; // Parallax effect
    });
    bgObjectsRef.current = bgObjectsRef.current.filter(obj => obj.x + obj.width > -100);

    // Update Obstacles
    obstaclesRef.current.forEach(obs => {
      obs.x -= OBSTACLE_SPEED;
    });

    // Remove off-screen obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > -100);

    // Collision Detection
    for (const obs of obstaclesRef.current) {
      if (
        tolya.x < obs.x + obs.width &&
        tolya.x + tolya.width > obs.x &&
        tolya.y < obs.y + obs.height &&
        tolya.y + tolya.height > obs.y
      ) {
        setLossReason(obs.isGiant ? 'giant_bed' : 'normal');
        setGameState('lost');
        cancelAnimationFrame(requestRef.current);
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        return;
      }

      // Score counting
      if (!obs.passed && tolya.x > obs.x + obs.width) {
        obs.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }
    }
  };

  useEffect(() => {
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans select-none overflow-hidden">
      <div className="relative w-full max-w-[800px] bg-sky-200 rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700">
        
        {/* Header */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
          <div className="bg-white/80 p-2 rounded-lg shadow backdrop-blur-sm">
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              Помоги Толе сбежать от с*кса в лес, <br/>
              <span className="text-emerald-600">там ждет ЛУНКА!</span>
            </h1>
          </div>
          <div className="flex flex-col gap-2 items-end">
             <div className="bg-white/90 px-4 py-2 rounded-lg shadow font-mono text-2xl font-bold text-indigo-600 border-2 border-indigo-200">
              Score: {score} / {WIN_SCORE}
            </div>
             {highScore > 0 && (
               <div className="bg-yellow-100/90 px-3 py-1 rounded text-sm font-bold text-yellow-700 border border-yellow-300">
                 High Score: {highScore}
               </div>
             )}
          </div>
        </div>

        {/* Game Area */}
        <div 
          className="relative overflow-hidden bg-gradient-to-b from-sky-300 to-sky-100"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
        >
          {/* Background Elements (Clouds) */}
          <div className="absolute top-10 left-20 text-white/40 animate-pulse">
            <CloudIcon size={64} />
          </div>
          <div className="absolute top-24 right-40 text-white/30 animate-pulse delay-700">
            <CloudIcon size={48} />
          </div>
          
          {/* Background Objects (Trees) */}
          {bgObjects.map(obj => (
            <div
              key={obj.id}
              className="absolute pointer-events-none opacity-80"
              style={{
                left: obj.x,
                top: obj.y,
                width: obj.width,
                height: obj.height
              }}
            >
              <TreeObject type={obj.type} />
            </div>
          ))}

          {/* Ground */}
          <div 
            className="absolute bottom-0 left-0 w-full bg-emerald-600 border-t-4 border-emerald-700"
            style={{ height: GROUND_HEIGHT }}
          >
             <div className="w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/grass.png')]"></div>
          </div>

          {/* Player (Tolya) */}
          {gameState !== 'won' && (
            <div 
              className="absolute transition-transform"
              style={{
                left: tolya.x,
                top: tolya.y,
                width: tolya.width,
                height: tolya.height,
                transform: tolya.direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)'
              }}
            >
              <TolyaImage isJumping={tolya.isJumping} direction={tolya.direction} />
            </div>
          )}

          {/* Obstacles (Beds) */}
          {obstacles.map(obs => (
            <div
              key={obs.id}
              className="absolute"
              style={{
                left: obs.x,
                top: obs.y,
                width: obs.width,
                height: obs.height,
                zIndex: obs.isGiant ? 5 : 1 // Giant beds render on top
              }}
            >
              <BedImage variant={obs.variant} isGiant={obs.isGiant} />
            </div>
          ))}

          {/* Won Scene (Forest) */}
          {gameState === 'won' && (
             <div className="absolute inset-0 bg-emerald-800/90 z-20 flex flex-col items-center justify-center animate-in fade-in duration-1000 p-8">
                <WinImage />
                <h2 className="text-4xl font-bold text-emerald-100 mt-8 text-center drop-shadow-lg leading-tight">
                  Толя нашел лунку!
                </h2>
                <p className="text-xl text-emerald-300 mt-2 text-center font-medium">
                  Он сбежал в лес и теперь отдыхает.
                </p>
                <button 
                  onClick={startGame}
                  className="mt-8 flex items-center gap-2 px-6 py-3 bg-white text-emerald-800 rounded-full font-bold hover:bg-emerald-100 transition-colors shadow-lg transform hover:scale-105 active:scale-95"
                >
                  <RotateCcw size={20} /> Играть снова
                </button>
             </div>
          )}

          {/* Menu / Game Over Overlay */}
          {(gameState === 'menu' || gameState === 'lost') && (
            <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center backdrop-blur-sm">
              <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md text-center border-4 border-indigo-500">
                {gameState === 'lost' ? (
                   <>
                    <div className="flex justify-center mb-4 text-red-500">
                      <Skull size={64} />
                    </div>
                    {lossReason === 'giant_bed' ? (
                      <>
                        <h2 className="text-3xl font-black text-red-600 mb-2 uppercase">Игра Окончена!</h2>
                        <p className="text-slate-800 font-bold text-xl mb-6">Света взяла за гузно!</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-3xl font-black text-slate-800 mb-2">GAME OVER</h2>
                        <p className="text-slate-600 mb-6">Tolya couldn't escape the beds...</p>
                      </>
                    )}
                   </>
                ) : (
                  <>
                     <div className="flex justify-center mb-4 text-indigo-500">
                       <User size={64} />
                     </div>
                     <h2 className="text-2xl font-black text-slate-800 mb-2">Ready to Run?</h2>
                     <p className="text-slate-600 mb-6">Use Arrow Keys to move & jump.<br/>Avoid the beds to reach the forest!</p>
                  </>
                )}
                
                <button 
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-xl hover:bg-indigo-700 transition-transform active:scale-95 shadow-lg shadow-indigo-200"
                >
                  <Play size={24} fill="currentColor" />
                  {gameState === 'lost' ? 'Try Again' : 'Start Game'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Controls Hint */}
        <div className="bg-slate-800 p-2 text-center text-slate-400 text-sm font-mono">
           ARROWS to Move • SPACE/UP to Jump
        </div>
      </div>
    </div>
  );
}

// Simple Cloud Component for decoration
function CloudIcon({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.132 20.177 10.2016 17.85 10.0267C17.4851 6.64366 14.629 4 11 4C7.03264 4 3.76632 6.95383 3.19796 10.7816C1.35086 11.5359 0 13.3444 0 15.5C0 18.5376 2.46243 21 5.5 21H17.5V19Z" />
    </svg>
  );
}
