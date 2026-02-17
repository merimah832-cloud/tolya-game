import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RotateCcw, Sparkles, Cloud as CloudIcon, Skull, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { BedImage, TolyaImage, TreeObject, WinImage } from './components/GameAssets';
import StartMenu from './components/StartMenu';

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
const GIANT_BED_HEIGHT = 250;
const GIANT_BED_WIDTH = 300;
const MINIBOSS_WIDTH = 100;
const MINIBOSS_HEIGHT = 70;
const OBSTACLE_SPEED_NORMAL = 6;
const OBSTACLE_SPEED_FAST = 7;
const OBSTACLE_SPEED_MAX = 8;
const WIN_SCORE = 50;
const MINIBOSS_SCORE_TRIGGER = 25;
const MAX_SPEED_SCORE_TRIGGER = 40;

type GameState = 'menu' | 'playing' | 'won' | 'lost' | 'paused';
type LossReason = 'normal' | 'miniboss' | 'giant' | 'branch';

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
  canDoubleJump?: boolean; // Added for Level 2
}

interface Obstacle extends GameObject {
  id: number;
  passed: boolean;
  variant: number;
  isGiant: boolean;
  isMiniboss: boolean;
  isMushroom: boolean;
}

interface BackgroundObj extends GameObject {
  id: number;
  type: number;
}

interface Branch extends GameObject {
  id: number;
  speed: number;
}

export function App() {
  const [gameState, setGameState] = useState<GameState>('menu');
  const [lossReason, setLossReason] = useState<LossReason>('normal');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [hasMushroomPower, setHasMushroomPower] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [level, setLevel] = useState(1);
  const [showLevel2Button, setShowLevel2Button] = useState(false);
  const [showLevel2Intro, setShowLevel2Intro] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // Scale handling
  const [scale, setScale] = useState(1);
  const gameContainerRef = useRef<HTMLDivElement>(null);

  // Refs for game loop and physics
  const requestRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const frameCount = useRef<number>(0);
  const gameStateRef = useRef<GameState>('menu');
  const levelRef = useRef(1);
  const isMinibossActiveRef = useRef(false);
  const hasSpawnedMinibossRef = useRef(false);
  const hasMushroomPowerRef = useRef(false);
  const hasSpawnedMushroomRef = useRef(false);
  const mushroomPowerCounterRef = useRef(0);
  const isDevModeRef = useRef(false);
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
  const branchesRef = useRef<Branch[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const obstacleIdRef = useRef(0);
  const branchIdRef = useRef(0);

  const [tolya, setTolya] = useState<TolyaState>(tolyaRef.current);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [bgObjects, setBgObjects] = useState<BackgroundObj[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

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

  // Bug Fix: Clear stuck controls
  useEffect(() => {
    if (gameState !== 'playing') {
      keysPressed.current = {};
    }
  }, [gameState]);

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

  // Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Resize handling
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

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
      );
    };
    checkTouch();
    window.addEventListener('touchstart', checkTouch, { once: true });
    return () => window.removeEventListener('touchstart', checkTouch);
  }, []);

  // Level 2 Transition Timer
  useEffect(() => {
    if (gameState === 'won' && level === 1) {
      const timer = setTimeout(() => {
        setShowLevel2Button(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState, level]);

  const startGame = () => {
    // Robust reset: ensure old loop is dead before starting new state
    cancelAnimationFrame(requestRef.current);

    setGameState('playing');
    gameStateRef.current = 'playing';
    keysPressed.current = {};
    setLossReason('normal');
    setScore(0);
    scoreRef.current = 0;
    frameCount.current = 0;
    obstacleIdRef.current = 0;
    isMinibossActiveRef.current = false;
    hasSpawnedMinibossRef.current = false;
    setShowWarning(false);
    setHasMushroomPower(false);
    hasMushroomPowerRef.current = false;
    hasSpawnedMushroomRef.current = false;
    mushroomPowerCounterRef.current = 0;

    const startY = GAME_HEIGHT - GROUND_HEIGHT - TOLYA_HEIGHT;
    const initialTolya: TolyaState = { // Explicitly type initialTolya
      x: 50,
      y: startY,
      width: TOLYA_WIDTH,
      height: TOLYA_HEIGHT,
      vy: 0,
      isJumping: false,
      direction: 'right' as const,
      canDoubleJump: false // Initialize canDoubleJump
    };
    tolyaRef.current = initialTolya;
    setTolya(initialTolya);
    obstaclesRef.current = [];
    setObstacles([]);
    bgObjectsRef.current = [];
    setBgObjects([]);

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const startLevel = (levelIndex: number) => {
    cancelAnimationFrame(requestRef.current);
    setLevel(levelIndex);
    levelRef.current = levelIndex;
    setShowLevel2Button(false);

    if (levelIndex === 2) {
      setShowLevel2Intro(true);
      setGameState('paused'); // Wait for intro
      gameStateRef.current = 'paused';
    }

    // Reset position but keep total score progress AND Developer Mode
    tolyaRef.current = {
      ...tolyaRef.current,
      x: 50,
      y: GAME_HEIGHT - GROUND_HEIGHT - TOLYA_HEIGHT, // Reset Y position
      vy: 0,
      isJumping: false,
      canDoubleJump: false // Reset canDoubleJump
    };

    obstaclesRef.current = [];
    isMinibossActiveRef.current = false;
    hasSpawnedMinibossRef.current = false;

    // Reset Developer Mode when starting Level 2
    isDevModeRef.current = false;
    setIsDevMode(false);
    console.log('🔄 Developer Mode RESET for Level 2');

    gameStateRef.current = 'playing';
    setGameState('playing');
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = () => {
    const tolya = tolyaRef.current;

    // Difficulty: Speed based on level and score
    let currentBaseSpeed = levelRef.current === 2 ? 8 : OBSTACLE_SPEED_NORMAL;
    if (levelRef.current === 1) {
      if (scoreRef.current >= MAX_SPEED_SCORE_TRIGGER) currentBaseSpeed = OBSTACLE_SPEED_MAX;
      else if (scoreRef.current >= MINIBOSS_SCORE_TRIGGER) currentBaseSpeed = OBSTACLE_SPEED_FAST;
    }
    const obstacleSpeed = currentBaseSpeed;

    if (keysPressed.current['ArrowRight']) { tolya.x += MOVEMENT_SPEED; tolya.direction = 'right'; }
    if (keysPressed.current['ArrowLeft']) { tolya.x -= MOVEMENT_SPEED; tolya.direction = 'left'; }

    // Jump: Handle double jump in Level 2
    if (keysPressed.current['ArrowUp'] || keysPressed.current['Space']) {
      if (!tolya.isJumping) {
        tolya.vy = hasMushroomPowerRef.current ? JUMP_FORCE_POWERED : JUMP_FORCE_NORMAL;
        tolya.isJumping = true;
        tolya.canDoubleJump = levelRef.current === 2;
      } else if (tolya.canDoubleJump) {
        tolya.vy = hasMushroomPowerRef.current ? JUMP_FORCE_POWERED : JUMP_FORCE_NORMAL;
        tolya.canDoubleJump = false;
      }
      delete keysPressed.current['ArrowUp'];
      delete keysPressed.current['Space'];
    }

    tolya.vy += GRAVITY;
    tolya.y += tolya.vy;

    if (tolya.y > GAME_HEIGHT - GROUND_HEIGHT - tolya.height) {
      tolya.y = GAME_HEIGHT - GROUND_HEIGHT - tolya.height;
      tolya.vy = 0;
      tolya.isJumping = false;
      tolya.canDoubleJump = false;
    }

    // Keep inside bounds
    tolya.x = Math.max(0, Math.min(tolya.x, GAME_WIDTH - tolya.width));

    frameCount.current++;
    const minSpawnTime = obstacleSpeed >= OBSTACLE_SPEED_FAST ? 40 : 60;

    if (frameCount.current > minSpawnTime && Math.random() < 0.02) {
      // Level-based probabilities
      let isGiantChance = 0.02;
      let minibossProbability = 0.25;

      if (levelRef.current === 2) {
        isGiantChance = 0.01;
        minibossProbability = (scoreRef.current >= 50 && scoreRef.current <= 55) ? 0.50 : 0.05;
      }

      // 1. Check for GIANT BED (Boss) spawn FIRST
      const isGiant = Math.random() < isGiantChance;

      if (isGiant) {
        obstaclesRef.current.push({
          x: GAME_WIDTH,
          y: GAME_HEIGHT - GROUND_HEIGHT - GIANT_BED_HEIGHT,
          width: GIANT_BED_WIDTH,
          height: GIANT_BED_HEIGHT,
          id: obstacleIdRef.current++,
          passed: false,
          variant: Math.floor(Math.random() * 3),
          isGiant: true,
          isMiniboss: false,
          isMushroom: false
        });
      }
      // 2. Check for MINIBOSS
      // Level 1: One-time spawn after trigger. Level 2: Always possible with dynamic probability.
      else if (
        (levelRef.current === 1 && isMinibossActiveRef.current && !hasSpawnedMinibossRef.current && Math.random() < minibossProbability) ||
        (levelRef.current === 2 && Math.random() < minibossProbability)
      ) {
        if (levelRef.current === 1) hasSpawnedMinibossRef.current = true;
        for (let i = 0; i < 3; i++) {
          obstaclesRef.current.push({
            x: GAME_WIDTH + (i * 350),
            y: GAME_HEIGHT - GROUND_HEIGHT - MINIBOSS_HEIGHT,
            width: MINIBOSS_WIDTH,
            height: MINIBOSS_HEIGHT,
            id: obstacleIdRef.current++,
            passed: false,
            variant: 0,
            isGiant: false,
            isMiniboss: true,
            isMushroom: false
          });
        }
        frameCount.current = -150;
      } else {
        // 3. Normal / Mushroom spawn
        const canSpawnMushroom = scoreRef.current > 25 && !hasSpawnedMushroomRef.current;
        const isMushroom = canSpawnMushroom && Math.random() < 0.10;

        if (isMushroom) {
          obstaclesRef.current.push({
            x: GAME_WIDTH, y: GAME_HEIGHT - GROUND_HEIGHT - 40, width: 40, height: 40,
            id: obstacleIdRef.current++, passed: false, variant: 0, isGiant: false, isMiniboss: false, isMushroom: true
          });
          hasSpawnedMushroomRef.current = true;
        } else {
          const h = BASE_BED_HEIGHT + Math.floor(Math.random() * 20);
          obstaclesRef.current.push({
            x: GAME_WIDTH, y: GAME_HEIGHT - GROUND_HEIGHT - h, width: BED_WIDTH, height: h,
            id: obstacleIdRef.current++, passed: false, variant: Math.floor(Math.random() * 3), isGiant: false, isMiniboss: false, isMushroom: false
          });
        }
      }
      if (frameCount.current > 0) frameCount.current = 0;
    }

    if (Math.random() < 0.01) {
      const scale = 0.5 + Math.random() * 0.5;
      bgObjectsRef.current.push({
        x: GAME_WIDTH, y: GAME_HEIGHT - GROUND_HEIGHT - (100 * scale) + 10,
        width: 100 * scale, height: 100 * scale, id: Date.now() + Math.random(), type: Math.floor(Math.random() * 2)
      });
    }

    // 4. Update Obstacles and Background Objects
    obstaclesRef.current = obstaclesRef.current.map((obs: Obstacle) => ({
      ...obs,
      x: obs.x - obstacleSpeed
    })).filter((obs: Obstacle) => obs.x + obs.width > -100);

    bgObjectsRef.current = bgObjectsRef.current.map((obj: BackgroundObj) => ({
      ...obj,
      x: obj.x - obstacleSpeed * 0.5
    })).filter((obj: BackgroundObj) => obj.x + obj.width > -50);

    // 6. Update Branches (Level 2 Only)
    if (levelRef.current === 2) {
      if (frameCount.current % 100 === 0 && Math.random() < 0.3) {
        branchesRef.current.push({
          x: Math.random() * (GAME_WIDTH - 20),
          y: -50,
          width: 20,
          height: 60,
          id: branchIdRef.current++,
          speed: 5 + Math.random() * 3
        });
      }

      branchesRef.current = branchesRef.current.map((b: Branch) => ({
        ...b,
        y: b.y + b.speed
      })).filter((b: Branch) => b.y < GAME_HEIGHT);
    } else {
      branchesRef.current = [];
    }

    // 7. Collision Detection
    const checkCollision = (obj: GameObject) => {
      return (
        tolya.x < obj.x + obj.width &&
        tolya.x + tolya.width > obj.x &&
        tolya.y < obj.y + obj.height &&
        tolya.y + tolya.height > obj.y
      );
    };

    for (let i = 0; i < obstaclesRef.current.length; i++) {
      const obs = obstaclesRef.current[i];
      if (checkCollision(obs)) { // Use the new checkCollision function
        if (obs.isMushroom) {
          hasMushroomPowerRef.current = true;
          setHasMushroomPower(true);
          mushroomPowerCounterRef.current = 0;
          obstaclesRef.current.splice(i, 1);
          i--; continue;
        }
        if (obs.isGiant) setLossReason('giant');
        else if (obs.isMiniboss) setLossReason('miniboss');
        else setLossReason('normal');
        setGameState('lost');
        keysPressed.current = {};
        cancelAnimationFrame(requestRef.current);
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        return;
      }
      if (!obs.passed && tolya.x > obs.x + obs.width) {
        obs.passed = true;
        const points = isDevModeRef.current ? 50 : 1;
        console.log('🎮 Developer Mode:', isDevModeRef.current, '| Points awarded:', points);
        scoreRef.current += points;
        setScore(scoreRef.current);
        if (hasMushroomPowerRef.current && !obs.isMushroom) {
          mushroomPowerCounterRef.current += 1;
          if (mushroomPowerCounterRef.current >= 5) {
            hasMushroomPowerRef.current = false;
            setHasMushroomPower(false);
          }
        }
      }
    }

    // Check for branch collisions
    for (let i = 0; i < branchesRef.current.length; i++) {
      const branch = branchesRef.current[i];
      if (checkCollision(branch)) {
        setLossReason('branch'); // New loss reason for branches
        setGameState('lost');
        keysPressed.current = {};
        cancelAnimationFrame(requestRef.current);
        if (scoreRef.current > highScore) setHighScore(scoreRef.current);
        return;
      }
    }
  };

  const gameLoop = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (scoreRef.current >= WIN_SCORE) { setGameState('won'); return; }
    if (scoreRef.current >= MINIBOSS_SCORE_TRIGGER && !isMinibossActiveRef.current) {
      isMinibossActiveRef.current = true;
      if (!hasSpawnedMinibossRef.current) setShowWarning(true);
    }
    updatePhysics();
    setTolya({ ...tolyaRef.current });
    setObstacles([...obstaclesRef.current]);
    setBgObjects([...bgObjectsRef.current]);
    setBranches([...branchesRef.current]);
    if (gameStateRef.current === 'playing') requestRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(requestRef.current);
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
        <div className="relative w-[800px] h-[400px] bg-slate-900 overflow-hidden shadow-2xl rounded-lg border-4 border-slate-700 select-none">

          {/* Start Menu */}
          {gameState === 'menu' && (
            <StartMenu
              onPlay={startGame}
              onToggleFullscreen={handleToggleFullscreen}
              onEnableDevMode={() => {
                console.log('✅ Developer Mode ACTIVATED');
                setIsDevMode(true);
                isDevModeRef.current = true;
              }}
            />
          )}

          {/* Parallax Background */}
          <div className="absolute top-10 left-20 text-white/40 animate-pulse">
            <CloudIcon size={64} />
          </div>
          <div className="absolute top-24 right-40 text-white/30 animate-pulse delay-700">
            <CloudIcon size={48} />
          </div>

          {bgObjects.map((obj) => (
            <div key={obj.id} className="absolute pointer-events-none opacity-80" style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height }}>
              <TreeObject type={obj.type} />
            </div>
          ))}

          {/* Header UI */}
          <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
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

          {showWarning && (
            <div className="absolute top-1/4 left-0 w-full text-center z-30 animate-pulse pointer-events-none">
              <h2 className="text-5xl font-black text-red-600 drop-shadow-lg tracking-widest uppercase" style={{ textShadow: '2px 2px 0 #000' }}>ОНИ ИДУТ!</h2>
            </div>
          )}
          {hasMushroomPower && (
            <div className="absolute top-1/4 left-0 w-full text-center z-30 animate-bounce pointer-events-none">
              <h2 className="text-4xl font-black text-green-600 drop-shadow-lg tracking-tight uppercase" style={{ textShadow: '2px 2px 0 #fff' }}>ЧУВСТВУЮ СИЛУ ЛЕСА!</h2>
            </div>
          )}

          {/* Ground */}
          <div className="absolute bottom-0 left-0 w-full bg-emerald-600 border-t-4 border-emerald-700" style={{ height: GROUND_HEIGHT }}>
            <div className="w-full h-full opacity-20 bg-[url('https://www.transparenttextures.com/patterns/grass.png')]"></div>
          </div>

          {level === 2 && (
            <div
              className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-1000"
              style={{
                background: `radial-gradient(circle 120px at ${tolya.x + tolya.width / 2}px ${tolya.y + tolya.height / 2}px, transparent 20%, rgba(0,0,0,0.85) 100%)`
              }}
            ></div>
          )}

          {/* entities */}
          {branches.map((branch: Branch) => (
            <div
              key={branch.id}
              className="absolute bg-amber-900 rounded-sm"
              style={{
                left: branch.x,
                top: branch.y,
                width: branch.width,
                height: branch.height,
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
              }}
            >
              {/* Branch details (simple) */}
              <div className="absolute top-1/4 left-0 w-full h-1 bg-amber-800 opacity-50"></div>
              <div className="absolute top-1/2 left-0 w-full h-1 bg-amber-800 opacity-50"></div>
            </div>
          ))}

          {gameState !== 'won' && (
            <div
              className="absolute transition-transform bg-no-repeat bg-contain"
              style={{
                left: tolya.x, top: tolya.y, width: tolya.width, height: tolya.height,
                transform: tolya.direction === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
                willChange: 'transform'
              }}
            >
              <TolyaImage isJumping={tolya.isJumping} direction={tolya.direction} isPowered={hasMushroomPower} />
            </div>
          )}

          {obstacles.map((obs: Obstacle) => (
            <div
              key={obs.id}
              className="absolute bg-no-repeat bg-contain"
              style={{
                left: obs.x, top: obs.y, width: obs.width, height: obs.height, zIndex: obs.isGiant ? 5 : 1,
                willChange: 'transform'
              }}
            >
              <BedImage variant={obs.variant} isGiant={obs.isGiant} isMiniboss={obs.isMiniboss} isMushroom={obs.isMushroom} />
            </div>
          ))}

          {/* Level 2 Intro Screen */}
          {showLevel2Intro && (
            <div className="absolute inset-0 z-[60] bg-black flex flex-col items-center justify-center p-8 text-center bg-no-repeat bg-center bg-cover" style={{ backgroundImage: "url('./assets/lvl2.png')" }}>
              <div className="bg-black/40 backdrop-blur-md p-10 rounded-3xl border border-white/20 shadow-2xl">
                <h1 className="text-6xl font-black text-white mb-4 uppercase tracking-tighter drop-shadow-2xl">
                  LEVEL 2
                </h1>
                <h2 className="text-3xl font-black text-indigo-300 mb-6 uppercase tracking-wider drop-shadow-xl">Тени сгущаются</h2>
                <p className="text-white text-xl mb-10 max-w-sm font-medium">Лес погрузился во тьму... Теперь ты видишь только то, что рядом.</p>
                <button
                  onClick={() => {
                    setShowLevel2Intro(false);
                    setGameState('playing');
                    gameStateRef.current = 'playing';
                    requestRef.current = requestAnimationFrame(gameLoop);
                  }}
                  className="px-16 py-5 bg-indigo-600 text-white rounded-full font-black text-2xl hover:bg-indigo-500 transition-all transform hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(79,70,229,0.6)]"
                >
                  АНАТОЛИЙ
                </button>
              </div>
            </div>
          )}

          {/* Won Scene */}
          {gameState === 'won' && (
            <div className="absolute inset-0 bg-emerald-800/90 z-20 flex flex-col items-center justify-center animate-in fade-in duration-1000 p-2 overflow-y-auto">
              <div className="flex flex-col items-center justify-center max-w-2xl w-full scale-90 sm:scale-100">
                <WinImage />
                <h2 className="text-3xl font-bold text-emerald-100 mt-4 text-center drop-shadow-lg">Толя нашел лунку!</h2>
                <div className="flex flex-col gap-3 mt-6">
                  <button
                    onClick={startGame}
                    className="flex items-center justify-center gap-2 px-6 py-2 bg-white text-emerald-800 rounded-full font-bold hover:bg-emerald-100 transition-colors shadow-lg transform active:scale-95"
                  >
                    <RotateCcw size={18} /> Играть снова
                  </button>

                  {showLevel2Button && (
                    <button
                      onClick={() => startLevel(2)}
                      className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-full font-black text-lg hover:bg-indigo-700 transition-all shadow-xl transform active:scale-95 animate-pulse"
                    >
                      <Sparkles size={20} /> LEVEL 2
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Game Over (Lost) */}
          {gameState === 'lost' && (
            <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm p-4 text-center">
              <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full border-4 border-indigo-500 transform transition-all">
                {lossReason === 'giant' && (
                  <div className="flex justify-center mb-4">
                    <img src="./assets/end1.png" alt="End" className="max-h-48 rounded border-2 border-red-100 object-contain" />
                  </div>
                )}
                {lossReason === 'miniboss' && (
                  <div className="flex justify-center mb-4">
                    <img src="./assets/end2.png" alt="End2" className="max-h-48 rounded border-2 border-red-100 object-contain" />
                  </div>
                )}
                {lossReason === 'normal' && (
                  <div className="flex justify-center mb-4">
                    <img src="./assets/end3.png" alt="End3" className="max-h-48 rounded border-2 border-red-100 object-contain" />
                  </div>
                )}
                {lossReason === 'branch' && (
                  <div className="flex justify-center mb-4">
                    <Skull size={64} className="text-red-500" />
                  </div>
                )}

                <h2 className="text-3xl font-black text-red-600 mb-2 uppercase">
                  {lossReason === 'miniboss' ? 'НАПИЛСЯ ТЕПЕРЬ СТРАДАЕТ' :
                    lossReason === 'normal' ? 'ТЕБЯ ТРАХНУЛИ' :
                      lossReason === 'giant' ? 'СВЕТА взяла за гузно!' :
                        lossReason === 'branch' ? 'ВЕТКА УПАЛА НА ГОЛОВУ!' : 'ИГРА ОКОНЧЕНА'}
                </h2>
                {lossReason === 'branch' && <p className="text-emerald-100 text-lg mb-6 max-w-xs text-center">Осторожно! Сверху тоже падают опасности!</p>}
                <p className="text-slate-600 mb-6 font-bold truncate">Score: {score}</p>

                <button
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-xl font-bold transition-all shadow-lg active:scale-95"
                >
                  <RotateCcw className="w-6 h-6" />
                  ПОПРОБОВАТЬ СНОВА
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Controls Overlay (Moved inside inner container for correct scaling) */}
        {(isTouchDevice && gameState === 'playing') && (
          <div className="absolute bottom-0 left-0 w-full px-1 flex justify-between items-end z-40 pointer-events-none pb-1">
            <div className="flex gap-1 pointer-events-auto">
              <button
                className="w-16 h-16 flex items-center justify-center active:scale-90 transition-transform"
                onTouchStart={(e: React.TouchEvent) => { e.preventDefault(); keysPressed.current['ArrowLeft'] = true; }}
                onTouchEnd={(e: React.TouchEvent) => { e.preventDefault(); keysPressed.current['ArrowLeft'] = false; }}
              >
                <div className="w-12 h-12 bg-white/10 backdrop-blur-[1px] rounded-full flex items-center justify-center border border-white/20">
                  <ArrowLeft size={24} className="text-white opacity-40" />
                </div>
              </button>
              <button
                className="w-16 h-16 flex items-center justify-center active:scale-90 transition-transform"
                onTouchStart={(e: React.TouchEvent) => { e.preventDefault(); keysPressed.current['ArrowRight'] = true; }}
                onTouchEnd={(e: React.TouchEvent) => { e.preventDefault(); keysPressed.current['ArrowRight'] = false; }}
              >
                <div className="w-12 h-12 bg-white/10 backdrop-blur-[1px] rounded-full flex items-center justify-center border border-white/20">
                  <ArrowRight size={24} className="text-white opacity-40" />
                </div>
              </button>
            </div>
            <div className="pointer-events-auto">
              <button
                className="w-20 h-20 flex items-center justify-center active:scale-90 transition-transform"
                onTouchStart={(e: React.TouchEvent) => { e.preventDefault(); keysPressed.current['ArrowUp'] = true; }}
                onTouchEnd={(e: React.TouchEvent) => { e.preventDefault(); keysPressed.current['ArrowUp'] = false; }}
              >
                <div className="w-16 h-16 bg-white/10 backdrop-blur-[1px] rounded-full flex items-center justify-center border border-white/20">
                  <ArrowUp size={32} className="text-white opacity-40" />
                </div>
              </button>
            </div>
          </div>
        )}
        {/* Level 2 Intro Screen */}
        {showLevel2Intro && (
          <div className="absolute inset-0 z-[60] bg-black flex flex-col items-center justify-center p-8 text-center">
            <div className="animate-pulse mb-8">
              <div className="w-64 h-64 bg-indigo-900/50 rounded-full flex items-center justify-center border-4 border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.5)]">
                <span className="text-white text-6xl font-black italic">LEVEL 2</span>
              </div>
            </div>
            <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Ночной Кошмар</h1>
            <p className="text-indigo-300 text-xl mb-12 max-w-sm">Лес погрузился во тьму... Теперь ты видишь только то, что рядом.</p>
            <button
              onClick={() => {
                setShowLevel2Intro(false);
                setGameState('playing');
                gameStateRef.current = 'playing';
                requestRef.current = requestAnimationFrame(gameLoop);
              }}
              className="px-12 py-5 bg-white text-indigo-900 rounded-full font-black text-2xl hover:bg-indigo-50 transition-all transform hover:scale-110 active:scale-95 shadow-2xl"
            >
              ВБОЙ!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CloudIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.5 19C19.9853 19 22 16.9853 22 14.5C22 12.132 20.177 10.2016 17.85 10.0267C17.4851 6.64366 14.629 4 11 4C7.03264 4 3.76632 6.95383 3.19796 10.7816C1.35086 11.5359 0 13.3444 0 15.5C0 18.5376 2.46243 21 5.5 21H17.5V19Z" />
    </svg>
  );
}
