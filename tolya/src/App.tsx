// ... (imports remain)
import { useEffect, useRef, useState, useCallback } from 'react';
import { Skull, Play, RotateCcw, User, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { TolyaImage, BedImage, TreeObject, WinImage } from './components/GameAssets';

// Game Constants
const GRAVITY = 0.6;
const JUMP_FORCE_NORMAL = -12;
const JUMP_FORCE_POWERED = -18;
const MOVEMENT_SPEED = 5;
const GROUND_HEIGHT = 50; // pixels from bottom
const GAME_WIDTH = 800;
const GAME_HEIGHT = 400;
const TOLYA_WIDTH = 40;
const TOLYA_HEIGHT = 60;
const BED_WIDTH = 60;
const BASE_BED_HEIGHT = 40;
const GIANT_BED_HEIGHT = 250; // Impossible to jump over (Tolya jump ~150px)
const GIANT_BED_WIDTH = 300; // Wider to maintain aspect ratio
const MINIBOSS_WIDTH = 100; // Reduced size
const MINIBOSS_HEIGHT = 70; // Jumpable height
const OBSTACLE_SPEED_NORMAL = 6; // Start speed increased to 6
const OBSTACLE_SPEED_FAST = 7; // Speed after 25 points
const OBSTACLE_SPEED_MAX = 8; // Speed after 40 points
const WIN_SCORE = 50;
const MINIBOSS_SCORE_TRIGGER = 25;
const MAX_SPEED_SCORE_TRIGGER = 40;

type GameState = 'menu' | 'playing' | 'won' | 'lost';
type LossReason = 'normal' | 'giant_bed' | 'miniboss';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
}
// ... (TolyaState, Obstacle, BackgroundObj interfaces remain)
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
  isMiniboss: boolean; // Added isMiniboss flag
  isMushroom: boolean; // Added isMushroom
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
  const [showWarning, setShowWarning] = useState(false); // Warning text state
  const [hasMushroomPower, setHasMushroomPower] = useState(false); // Power-up state

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
  const gameStateRef = useRef<GameState>('menu');
  const isMinibossActiveRef = useRef(false); // Speed boost active
  const hasSpawnedMinibossRef = useRef(false); // Ensure only spawns once
  const hasMushroomPowerRef = useRef(false);
  const hasSpawnedMushroomRef = useRef(false); // Only once per game
  const mushroomPowerCounterRef = useRef(0); // Count obstacles passed

  // Sync ref with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Warning timer
  useEffect(() => {
    if (showWarning) {
      const timer = setTimeout(() => setShowWarning(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showWarning]);

  // Bug Fix: Clear stuck controls when game state changes (e.g. lost/menu)
  useEffect(() => {
    if (gameState !== 'playing') {
      keysPressed.current = {};
    }
  }, [gameState]);

  // Input handling
  // ... (Input handling remains same)
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
  }, [gameState]);

  const startGame = () => {
    setGameState('playing');
    gameStateRef.current = 'playing';
    keysPressed.current = {}; // Clear any stuck keys/touches from previous session
    setLossReason('normal');
    setScore(0);
    scoreRef.current = 0;
    frameCount.current = 0;
    isMinibossActiveRef.current = false;
    hasSpawnedMinibossRef.current = false;
    setShowWarning(false);
    setHasMushroomPower(false);
    hasMushroomPowerRef.current = false;
    hasSpawnedMushroomRef.current = false;
    mushroomPowerCounterRef.current = 0;

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
    if (gameStateRef.current !== 'playing') return;

    if (scoreRef.current >= WIN_SCORE) {
      setGameState('won');
      return;
    }

    // Miniboss TRIGGER phase (Speed increase at 25)
    if (scoreRef.current >= MINIBOSS_SCORE_TRIGGER && !isMinibossActiveRef.current) {
      isMinibossActiveRef.current = true;
      // Show warning only if Miniboss hasn't spawned yet (effectively once)
      if (!hasSpawnedMinibossRef.current) {
        setShowWarning(true);
      }
    }

    updatePhysics();

    setTolya({ ...tolyaRef.current });
    setObstacles([...obstaclesRef.current]);
    setBgObjects([...bgObjectsRef.current]);

    if (gameStateRef.current === 'playing') {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  }, []);

  const updatePhysics = () => {
    const tolya = tolyaRef.current;

    // Determine Speed
    let currentSpeed = OBSTACLE_SPEED_NORMAL;
    if (scoreRef.current >= MAX_SPEED_SCORE_TRIGGER) {
      currentSpeed = OBSTACLE_SPEED_MAX;
    } else if (scoreRef.current >= MINIBOSS_SCORE_TRIGGER) {
      currentSpeed = OBSTACLE_SPEED_FAST;
    }

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
      tolya.vy = hasMushroomPowerRef.current ? JUMP_FORCE_POWERED : JUMP_FORCE_NORMAL;
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
    // Decrease spawning time as speed increases to keep challenge up
    const minSpawnTime = currentSpeed >= OBSTACLE_SPEED_FAST ? 40 : 60;

    if (frameCount.current > minSpawnTime && Math.random() < 0.02) {
      // Miniboss Spawn Logic (Once per game, 25% chance after trigger)
      if (
        isMinibossActiveRef.current &&
        !hasSpawnedMinibossRef.current &&
        Math.random() < 0.25
      ) {
        hasSpawnedMinibossRef.current = true; // Mark as spawned
        // 3-in-a-row Miniboss spawn
        for (let i = 0; i < 3; i++) {
          const spacing = 350; // WIDER spacing for easier jumps
          const obstacle: Obstacle = {
            x: GAME_WIDTH + (i * spacing),
            y: GAME_HEIGHT - GROUND_HEIGHT - MINIBOSS_HEIGHT,
            width: MINIBOSS_WIDTH,
            height: MINIBOSS_HEIGHT,
            id: Date.now() + i,
            passed: false,
            variant: 0,
            isGiant: false,
            isMiniboss: true,
            isMushroom: false
          };
          obstaclesRef.current.push(obstacle);
        }
        frameCount.current = -150; // Longer delay next spawn
      } else {
        // Normal/Giant/Mushroom spawn
        const canSpawnMushroom = scoreRef.current > 25 && !hasSpawnedMushroomRef.current;
        const isMushroom = canSpawnMushroom && Math.random() < 0.10; // 10% chance after 25 points

        if (isMushroom) {
          const obstacle: Obstacle = {
            x: GAME_WIDTH,
            y: GAME_HEIGHT - GROUND_HEIGHT - 40, // Mushroom height
            width: 40,
            height: 40,
            id: Date.now(),
            passed: false,
            variant: 0,
            isGiant: false,
            isMiniboss: false,
            isMushroom: true
          };
          obstaclesRef.current.push(obstacle);
          hasSpawnedMushroomRef.current = true; // Mark as spawned
        } else {
          // Normal or Giant spawn
          const isGiant = Math.random() < 0.01;
          const randomHeightAdd = Math.floor(Math.random() * 20);
          const height = isGiant ? GIANT_BED_HEIGHT : (BASE_BED_HEIGHT + randomHeightAdd);
          const width = isGiant ? GIANT_BED_WIDTH : BED_WIDTH;

          const obstacle: Obstacle = {
            x: GAME_WIDTH,
            y: GAME_HEIGHT - GROUND_HEIGHT - height,
            width: width,
            height: height,
            id: Date.now(),
            passed: false,
            variant: Math.floor(Math.random() * 3),
            isGiant: isGiant,
            isMiniboss: false, // Ensure defaults
            isMushroom: false
          };
          obstaclesRef.current.push(obstacle);
        }
      }
      if (frameCount.current > 0) frameCount.current = 0;
    }

    // Spawn Background Objects (Trees)
    if (Math.random() < 0.01) {
      const scale = 0.5 + Math.random() * 0.5;
      const bgObj: BackgroundObj = {
        x: GAME_WIDTH,
        y: GAME_HEIGHT - GROUND_HEIGHT - (100 * scale) + 10,
        width: 100 * scale,
        height: 100 * scale,
        id: Date.now() + Math.random(),
        type: Math.floor(Math.random() * 2)
      };
      bgObjectsRef.current.push(bgObj);
    }

    // Update Background Objects
    bgObjectsRef.current.forEach((obj: BackgroundObj) => {
      obj.x -= currentSpeed * 0.5;
    });
    bgObjectsRef.current = bgObjectsRef.current.filter((obj: BackgroundObj) => obj.x + obj.width > -100);

    // Update Obstacles
    obstaclesRef.current.forEach((obs: Obstacle) => {
      obs.x -= currentSpeed;
    });

    // Remove off-screen obstacles
    obstaclesRef.current = obstaclesRef.current.filter((obs: Obstacle) => obs.x + obs.width > -100);

    // Collision Detection
    for (let i = 0; i < obstaclesRef.current.length; i++) {
      const obs = obstaclesRef.current[i];
      if (
        tolya.x < obs.x + obs.width &&
        tolya.x + tolya.width > obs.x &&
        tolya.y < obs.y + obs.height &&
        tolya.y + tolya.height > obs.y
      ) {
        if (obs.isMushroom) {
          // Collect Mushroom
          hasMushroomPowerRef.current = true;
          setHasMushroomPower(true);
          mushroomPowerCounterRef.current = 0; // Reset counter on collection
          // Remove mushroom from array
          obstaclesRef.current.splice(i, 1);
          i--; // Adjust index
          continue; // Skip game over check
        }

        if (obs.isGiant) setLossReason('giant_bed');
        else if (obs.isMiniboss) setLossReason('miniboss');
        else setLossReason('normal');

        setGameState('lost');
        keysPressed.current = {}; // Stop movement immediately
        cancelAnimationFrame(requestRef.current);
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        return;
      }

      // Score counting
      if (!obs.passed && tolya.x > obs.x + obs.width) {
        obs.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);

        // Deactivate power-up after 5 obstacles
        if (hasMushroomPowerRef.current && !obs.isMushroom) {
          mushroomPowerCounterRef.current += 1;
          if (mushroomPowerCounterRef.current >= 5) {
            hasMushroomPowerRef.current = false;
            setHasMushroomPower(false);
          }
        }
      }
    }
  };

  useEffect(() => {
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  // Scale handling
  const [scale, setScale] = useState(1);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const scaleX = windowWidth / GAME_WIDTH;
      const scaleY = windowHeight / GAME_HEIGHT;
      setScale(Math.min(scaleX, scaleY));
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center overflow-hidden touch-none">
      <div
        ref={gameContainerRef}
        className="relative shadow-2xl"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
        <div className="relative w-full h-full bg-sky-200 overflow-hidden border-4 border-slate-700 bg-gradient-to-b from-sky-300 to-sky-100">

          {/* Header */}
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
            {/* ... (Header content) unchanged ... */}
            <div className="bg-white/80 p-2 rounded-lg shadow backdrop-blur-sm origin-top-left transition-transform" style={{ transform: 'scale(0.8)' }}>
              <h1 className="text-xl font-bold text-slate-800 leading-tight">
                Помоги Толе сбежать от с*кса в лес, <br />
                <span className="text-emerald-600">там ждет ЛУНКА!</span>
              </h1>
            </div>
            <div className="flex flex-col gap-2 items-end origin-top-right transition-transform" style={{ transform: 'scale(0.8)' }}>
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

          {/* Miniboss Warning */}
          {showWarning && (
            <div className="absolute top-1/4 left-0 w-full text-center z-30 animate-pulse pointer-events-none">
              <h2 className="text-5xl font-black text-red-600 drop-shadow-lg tracking-widest uppercase" style={{ textShadow: '2px 2px 0 #000' }}>
                ОНИ ИДУТ!
              </h2>
            </div>
          )}

          {/* Mushroom Power-up Text */}
          {hasMushroomPower && (
            <div className="absolute top-1/4 left-0 w-full text-center z-30 animate-bounce pointer-events-none">
              <h2 className="text-4xl font-black text-green-600 drop-shadow-lg tracking-tight uppercase" style={{ textShadow: '2px 2px 0 #fff' }}>
                ЧУВСТВУЮ СИЛУ ЛЕСА!
              </h2>
            </div>
          )}

          {/* Background Elements (Clouds) */}
          <div className="absolute top-10 left-20 text-white/40 animate-pulse">
            <CloudIcon size={64} />
          </div>
          <div className="absolute top-24 right-40 text-white/30 animate-pulse delay-700">
            <CloudIcon size={48} />
          </div>

          {/* Background Objects (Trees) */}
          {bgObjects.map((obj: BackgroundObj) => (
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
              <TolyaImage isJumping={tolya.isJumping} direction={tolya.direction} isPowered={hasMushroomPower} />
            </div>
          )}

          {/* Obstacles (Beds) */}
          {obstacles.map((obs: Obstacle) => (
            <div
              key={obs.id}
              className="absolute"
              style={{
                left: obs.x,
                top: obs.y,
                width: obs.width,
                height: obs.height,
                zIndex: obs.isGiant ? 5 : 1
              }}
            >
              <BedImage variant={obs.variant} isGiant={obs.isGiant} isMiniboss={obs.isMiniboss} isMushroom={obs.isMushroom} />
            </div>
          ))}

          {/* Won Scene */}
          {/* ... (Won scene remains) ... */}
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
        </div>
      </div>

      {/* Menu / Game Over Overlay */}
      {(gameState === 'menu' || gameState === 'lost') && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border-4 border-indigo-500 transform transition-all">
            {gameState === 'lost' ? (
              <>
                {lossReason === 'giant_bed' ? (
                  <div className="flex justify-center mb-4">
                    <img
                      src="/assets/end1.png"
                      alt="Game Over Boss"
                      className="rounded-lg shadow-lg max-h-64 object-contain border-4 border-red-500 bg-white"
                    />
                  </div>
                ) : lossReason === 'miniboss' ? (
                  <div className="flex justify-center mb-4">
                    <img
                      src="/assets/end2.png"
                      alt="Game Over Miniboss"
                      className="rounded-lg shadow-lg max-h-64 object-contain border-4 border-red-500 bg-white"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center mb-4 text-red-500">
                    <Skull size={64} />
                  </div>
                )}

                {lossReason === 'giant_bed' ? (
                  <>
                    <h2 className="text-2xl md:text-3xl font-black text-red-600 mb-2 uppercase">Игра Окончена!</h2>
                    <p className="text-slate-800 font-bold text-lg md:text-xl mb-6">Света взяла за гузно!</p>
                  </>
                ) : lossReason === 'miniboss' ? (
                  <>
                    <h2 className="text-2xl md:text-3xl font-black text-red-600 mb-2 uppercase">ИГРА ОКОНЧЕНА</h2>
                    <p className="text-slate-800 font-bold text-lg md:text-xl mb-6">НАПИЛСЯ ТЕПЕРЬ СТРАДАЕТ</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-2">GAME OVER</h2>
                    <p className="text-slate-600 mb-6">Tolya couldn't escape the beds...</p>
                  </>
                )}
              </>
            ) : (
              // ... (Start menu remains) ...
              <>
                <div className="flex justify-center mb-4 text-indigo-500">
                  <User size={64} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">Ready to Run?</h2>
                <p className="text-slate-600 mb-6">Use Arrow Keys to move & jump.<br />Avoid the beds to reach the forest!</p>
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

      {/* Controls */}
      {/* ... (Controls remain) ... */}
      {gameState === 'playing' && (
        <div className="fixed bottom-4 left-0 w-full px-4 md:px-12 flex justify-between items-end z-40 pointer-events-none">
          {/* Left/Right Controls */}
          <div className="flex gap-4 pointer-events-auto pb-safe">
            <button
              className="w-20 h-20 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 active:bg-white/50 touch-none select-none transition-transform active:scale-95 shadow-lg"
              onTouchStart={(e) => { e.preventDefault(); keysPressed.current['ArrowLeft'] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysPressed.current['ArrowLeft'] = false; }}
              onMouseDown={() => keysPressed.current['ArrowLeft'] = true}
              onMouseUp={() => keysPressed.current['ArrowLeft'] = false}
              onMouseLeave={() => keysPressed.current['ArrowLeft'] = false}
            >
              <ArrowLeft size={40} className="text-white drop-shadow-md" />
            </button>

            <button
              className="w-20 h-20 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 active:bg-white/50 touch-none select-none transition-transform active:scale-95 shadow-lg"
              onTouchStart={(e) => { e.preventDefault(); keysPressed.current['ArrowRight'] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysPressed.current['ArrowRight'] = false; }}
              onMouseDown={() => keysPressed.current['ArrowRight'] = true}
              onMouseUp={() => keysPressed.current['ArrowRight'] = false}
              onMouseLeave={() => keysPressed.current['ArrowRight'] = false}
            >
              <ArrowRight size={40} className="text-white drop-shadow-md" />
            </button>
          </div>

          {/* Jump Control */}
          <div className="pointer-events-auto pb-safe">
            <button
              className="w-24 h-24 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 active:bg-white/50 touch-none select-none transition-transform active:scale-95 shadow-lg"
              onTouchStart={(e) => { e.preventDefault(); keysPressed.current['ArrowUp'] = true; }}
              onTouchEnd={(e) => { e.preventDefault(); keysPressed.current['ArrowUp'] = false; }}
              onMouseDown={() => keysPressed.current['ArrowUp'] = true}
              onMouseUp={() => keysPressed.current['ArrowUp'] = false}
              onMouseLeave={() => keysPressed.current['ArrowUp'] = false}
            >
              <ArrowUp size={48} className="text-white drop-shadow-md" />
            </button>
          </div>
        </div>
      )}
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
