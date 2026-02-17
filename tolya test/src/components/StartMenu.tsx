import React from 'react';

interface StartMenuProps {
    onPlay: () => void;
    onToggleFullscreen: () => void;
    onEnableDevMode: () => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ onPlay, onToggleFullscreen, onEnableDevMode }) => {
    // Set this to 'false' once you have perfectly aligned the buttons!
    const [showDebug, setShowDebug] = React.useState(false);

    return (
        <div className="absolute inset-0 z-50 overflow-hidden">
            {/* Background Image (User's custom drawn image) */}
            <div
                className="absolute inset-0 bg-cover bg-center z-0"
                style={{
                    backgroundImage: 'url("./assets/start.png")',
                    backgroundColor: '#1a2e1a'
                }}
            />

            {/* Developer Mode Trigger */}
            <div
                className={`absolute left-1/2 -translate-x-1/2 z-[100] cursor-pointer font-black transition-all select-none flex flex-col items-center justify-center
                    ${showDebug
                        ? 'top-20 text-white bg-red-600 border-8 border-white scale-125 text-6xl w-32 h-32 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,1)] animate-bounce'
                        : 'top-2 text-white/5 hover:text-white/20 text-lg w-8 h-8 rounded-full border border-transparent hover:border-white/10'}`}
                onClick={() => {
                    const pass = window.prompt("Введите код разработчика (1345):");
                    if (pass === "1345") {
                        onEnableDevMode();
                        alert("✅ РЕЖИМ РАЗРАБОТЧИКА АКТИВИРОВАН!\n(1 прыжок = 50 очков)");
                    }
                }}
            >
                !
                {showDebug && (
                    <div className="mt-2 bg-black text-white text-xs px-2 py-1 rounded font-bold uppercase tracking-widest whitespace-nowrap">
                        КНОПКА РАЗРАБОТЧИКА
                    </div>
                )}
            </div>

            {/* Debug Toggle (Click anywhere empty to toggle visibility of zones) */}
            <div
                className="absolute top-2 left-2 z-50 bg-black/50 text-white text-[10px] px-2 py-1 rounded cursor-pointer select-none"
                onClick={() => setShowDebug(!showDebug)}
            >
                {showDebug ? "Hide Zones (Current: Visible)" : "Show Zones (Current: Invisible)"}
            </div>

            {/* 
              Invisible Trigger Zones 
              Adjust these coordinates (top, left, width, height) 
              to match your drawing perfectly!
            */}

            {/* PLAY BUTTON ZONE */}
            <button
                onClick={onPlay}
                aria-label="Play Game"
                className={`absolute z-30 touch-none select-none transition-all transform active:scale-95 cursor-pointer border-2 ${showDebug ? 'bg-red-500/30 border-red-500' : 'bg-transparent border-transparent'}`}
                style={{
                    top: '75%',      // Moved from 45% to 65% (typical button spot)
                    left: '45%',
                    width: '220px',  // Wider for "START"
                    height: '90px',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '2px'
                }}
            >
                {showDebug && <span className="text-white font-bold pointer-events-none text-xl">START ZONE</span>}
            </button>

            {/* FULLSCREEN BUTTON ZONE */}
            <button
                onClick={onToggleFullscreen}
                aria-label="Toggle Fullscreen"
                className={`absolute z-30 touch-none select-none transition-all transform active:scale-95 cursor-pointer border-2 ${showDebug ? 'bg-blue-500/30 border-blue-500' : 'bg-transparent border-transparent'}`}
                style={{
                    bottom: '10%',    // Bottom margin
                    right: '5%',      // Right margin
                    width: '100px',    // Adjust size
                    height: '100px',
                    borderRadius: '50%'
                }}
            >
                {showDebug && <span className="text-white text-[10px] font-bold pointer-events-none">FULLSCREEN</span>}
            </button>
        </div>
    );
};

export default StartMenu;

