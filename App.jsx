import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { usePronunciationScoring } from './src/hooks/usePronunciationScoring.js';
import SurveyModal from './src/components/SurveyModal.jsx';
import { supabase } from './src/lib/supabaseClient.js';

// Asset imports
import userDefault from './src/assets/user/default.png';
import userAttack from './src/assets/user/attack.png';
import userHurt from './src/assets/user/hurt.png';
import userDead from './src/assets/user/dead.png';
import userSpellFire from './src/assets/user/user-spell-fire.png';

import monsterDefault from './src/assets/monster/default.png';
import monsterAttack from './src/assets/monster/attack.png';
import monsterHurt from './src/assets/monster/hurt.png';
import monsterDead from './src/assets/monster/dead.png';
import monsterSpellFire from './src/assets/monster/monster-spell-fire.png';

// Constants
const AUDIO_TIME_OFFSET = 0.1;
const ROUND_TIME = 10; // 10 seconds per round
const MAX_PLAYER_HP = 6;
const MAX_ENEMY_HP = 6;

const WORD_LIST = [
    // Difficulty 1 - Very Easy (1 syllable, common words)
    { word: "CAT", diff: 1, syllables: 1, type: "n" },
    { word: "DOG", diff: 1, syllables: 1, type: "n" },
    { word: "BOOK", diff: 1, syllables: 1, type: "n" },
    { word: "DOOR", diff: 1, syllables: 1, type: "n" },
    { word: "TREE", diff: 1, syllables: 1, type: "n" },
    { word: "FISH", diff: 1, syllables: 1, type: "n" },
    { word: "BIRD", diff: 1, syllables: 1, type: "n" },
    { word: "HOUSE", diff: 1, syllables: 1, type: "n" },

    // Difficulty 2 - Easy (2 syllables, simple words)
    { word: "APPLE", diff: 2, syllables: 2, type: "n" },
    { word: "WATER", diff: 2, syllables: 2, type: "n" },
    { word: "HAPPY", diff: 2, syllables: 2, type: "adj" },
    { word: "MONEY", diff: 2, syllables: 2, type: "n" },
    { word: "PAPER", diff: 2, syllables: 2, type: "n" },
    { word: "FLOWER", diff: 2, syllables: 2, type: "n" },
    { word: "WINDOW", diff: 2, syllables: 2, type: "n" },
    { word: "MOTHER", diff: 2, syllables: 2, type: "n" },

    // Difficulty 3 - Medium Easy (1-2 syllables, action words)
    { word: "RUN", diff: 3, syllables: 1, type: "v" },
    { word: "JUMP", diff: 3, syllables: 1, type: "v" },
    { word: "WALK", diff: 3, syllables: 1, type: "v" },
    { word: "SLEEP", diff: 3, syllables: 1, type: "v" },
    { word: "STUDY", diff: 3, syllables: 2, type: "v" },
    { word: "LISTEN", diff: 3, syllables: 2, type: "v" },
    { word: "TRAVEL", diff: 3, syllables: 2, type: "v" },
    { word: "ANSWER", diff: 3, syllables: 2, type: "v" },

    // Difficulty 4 - Medium (2-3 syllables, common but longer)
    { word: "TOWER", diff: 4, syllables: 2, type: "n" },
    { word: "GARDEN", diff: 4, syllables: 2, type: "n" },
    { word: "KITCHEN", diff: 4, syllables: 2, type: "n" },
    { word: "PICTURE", diff: 4, syllables: 2, type: "n" },
    { word: "COMPUTER", diff: 4, syllables: 3, type: "n" },
    { word: "ELEPHANT", diff: 4, syllables: 3, type: "n" },
    { word: "HOSPITAL", diff: 4, syllables: 3, type: "n" },
    { word: "UMBRELLA", diff: 4, syllables: 3, type: "n" },

    // Difficulty 5 - Medium Hard (2-3 syllables, less common)
    { word: "BEAM", diff: 5, syllables: 1, type: "n" },
    { word: "MAGIC", diff: 5, syllables: 2, type: "n" },
    { word: "CASTLE", diff: 5, syllables: 2, type: "n" },
    { word: "DRAGON", diff: 5, syllables: 2, type: "n" },
    { word: "FOREST", diff: 5, syllables: 2, type: "n" },
    { word: "CRYSTAL", diff: 5, syllables: 2, type: "n" },
    { word: "ADVENTURE", diff: 5, syllables: 3, type: "n" },
    { word: "MYSTERY", diff: 5, syllables: 3, type: "n" },

    // Difficulty 6 - Hard (2-3 syllables, fantasy/complex)
    { word: "WIZARD", diff: 6, syllables: 2, type: "n" },
    { word: "KNIGHT", diff: 6, syllables: 1, type: "n" },
    { word: "POTION", diff: 6, syllables: 2, type: "n" },
    { word: "TREASURE", diff: 6, syllables: 2, type: "n" },
    { word: "KINGDOM", diff: 6, syllables: 2, type: "n" },
    { word: "WARRIOR", diff: 6, syllables: 3, type: "n" },
    { word: "ENCHANTED", diff: 6, syllables: 3, type: "adj" },
    { word: "POWERFUL", diff: 6, syllables: 3, type: "adj" },

    // Difficulty 7 - Very Hard (3+ syllables, complex words)
    { word: "PHANTOM", diff: 7, syllables: 2, type: "n" },
    { word: "SORCERER", diff: 7, syllables: 3, type: "n" },
    { word: "LEGENDARY", diff: 7, syllables: 4, type: "adj" },
    { word: "DANGEROUS", diff: 7, syllables: 3, type: "adj" },
    { word: "INVISIBLE", diff: 7, syllables: 4, type: "adj" },
    { word: "MYSTERIOUS", diff: 7, syllables: 4, type: "adj" },
    { word: "ADVENTURE", diff: 7, syllables: 3, type: "n" },
    { word: "CHAMPION", diff: 7, syllables: 3, type: "n" },

    // Difficulty 8 - Expert (3-4 syllables, advanced)
    { word: "BEAUTIFUL", diff: 8, syllables: 3, type: "adj" },
    { word: "INCREDIBLE", diff: 8, syllables: 4, type: "adj" },
    { word: "MAGNIFICENT", diff: 8, syllables: 4, type: "adj" },
    { word: "SPECTACULAR", diff: 8, syllables: 4, type: "adj" },
    { word: "FASCINATING", diff: 8, syllables: 4, type: "adj" },
    { word: "IMAGINATION", diff: 8, syllables: 5, type: "n" },
    { word: "CELEBRATION", diff: 8, syllables: 4, type: "n" },
    { word: "TRANSFORMATION", diff: 8, syllables: 4, type: "n" },

    // Difficulty 9 - Master (4-5 syllables, very advanced)
    { word: "EXTRAORDINARY", diff: 9, syllables: 5, type: "adj" },
    { word: "UNBELIEVABLE", diff: 9, syllables: 5, type: "adj" },
    { word: "REVOLUTIONARY", diff: 9, syllables: 6, type: "adj" },
    { word: "INCOMPREHENSIBLE", diff: 9, syllables: 6, type: "adj" },
    { word: "RESPONSIBILITY", diff: 9, syllables: 6, type: "n" },
    { word: "COMMUNICATION", diff: 9, syllables: 5, type: "n" },
    { word: "PRONUNCIATION", diff: 9, syllables: 5, type: "n" },
    { word: "DETERMINATION", diff: 9, syllables: 5, type: "n" },

    // Difficulty 10 - Legendary (5+ syllables, extremely challenging)
    { word: "COMPLICATED", diff: 10, syllables: 4, type: "adj" },
    { word: "SOPHISTICATED", diff: 10, syllables: 5, type: "adj" },
    { word: "INCOMPARABLE", diff: 10, syllables: 5, type: "adj" },
    { word: "INDESCRIBABLE", diff: 10, syllables: 5, type: "adj" },
    { word: "CHARACTERIZATION", diff: 10, syllables: 6, type: "n" },
    { word: "INTERNATIONALIZATION", diff: 10, syllables: 8, type: "n" },
    { word: "INCOMPREHENSIBILITY", diff: 10, syllables: 8, type: "n" },
    { word: "ANTIDISESTABLISHMENTARIANISM", diff: 10, syllables: 12, type: "n" },
];

// Game state enum
const GAME_STATES = {
    SPLASH: 'splash',
    MENU: 'menu',
    TUTORIAL: 'tutorial',
    INGAME: 'ingame',
    GAMEOVER: 'gameover'
};

// Round states
const ROUND_STATES = {
    WAITING: 'waiting',      // Waiting for user to start speaking
    LISTENING: 'listening',  // VAD is listening for speech
    PROCESSING: 'processing', // Processing audio and scoring
    FINISHED: 'finished'     // Round finished, showing results
};

// Sound effects using Tone.js
const createSounds = () => {
    const synth = new Tone.Synth().toDestination();
    return {
        pop: () => synth.triggerAttackRelease("C4", "8n", Tone.now() + AUDIO_TIME_OFFSET),
        damage: () => synth.triggerAttackRelease("G2", "4n", Tone.now() + AUDIO_TIME_OFFSET),
        success: () => synth.triggerAttackRelease("E4", "8n", Tone.now() + AUDIO_TIME_OFFSET),
        perfect: () => {
            synth.triggerAttackRelease("C5", "8n", Tone.now() + AUDIO_TIME_OFFSET);
            synth.triggerAttackRelease("E5", "8n", Tone.now() + AUDIO_TIME_OFFSET + 0.1);
        },
        fail: () => synth.triggerAttackRelease("F2", "2n", Tone.now() + AUDIO_TIME_OFFSET),
        heal: () => synth.triggerAttackRelease("A4", "4n", Tone.now() + AUDIO_TIME_OFFSET),
        levelUp: () => {
            synth.triggerAttackRelease("C4", "8n", Tone.now() + AUDIO_TIME_OFFSET);
            synth.triggerAttackRelease("E4", "8n", Tone.now() + AUDIO_TIME_OFFSET + 0.1);
            synth.triggerAttackRelease("G4", "8n", Tone.now() + AUDIO_TIME_OFFSET + 0.2);
        }
    };
};

// Utility functions
const getEnemyMaxHP = (floor) => Math.min(MAX_ENEMY_HP, 3 + Math.floor(floor / 5));
const getWordDifficulty = (floor) => Math.min(10, Math.floor(floor / 2) + 1);

// Character Components
const PlayerCharacter = React.forwardRef(({ state, className = "w-32 h-32" }, ref) => {
    const getPlayerAsset = () => {
        switch (state) {
            case 'attack': return userAttack;
            case 'hurt': return userHurt;
            case 'dead': return userDead;
            default: return userDefault;
        }
    };

    return (
        <div ref={ref} className={`${className} flex items-center justify-center`}>
            <img src={getPlayerAsset()} alt={`Player ${state}`} className="w-full h-full object-contain" />
        </div>
    );
});

const EnemyCharacter = React.forwardRef(({ state, className = "w-32 h-32" }, ref) => {
    const getEnemyAsset = () => {
        switch (state) {
            case 'attack': return monsterAttack;
            case 'hurt': return monsterHurt;
            case 'dead': return monsterDead;
            default: return monsterDefault;
        }
    };

    return (
        <div ref={ref} className={`${className} flex items-center justify-center`}>
            <img src={getEnemyAsset()} alt={`Enemy ${state}`} className="w-full h-full object-contain" />
        </div>
    );
});

// Heart Icon for HP display
const HeartIcon = ({ filled, className = "w-8 h-8" }) => (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

// Flying Spell Component
const FlyingSpell = ({ flyingSpell, playerRef, enemyRef }) => {
    if (!flyingSpell || !flyingSpell.active) return null;

    const isPlayerSpell = flyingSpell.type === 'player';
    const spellImage = isPlayerSpell ? userSpellFire : monsterSpellFire;

    const getCharacterPosition = (ref) => {
        if (!ref?.current) return { left: 0, top: 0 };
        const rect = ref.current.getBoundingClientRect();
        return {
            left: rect.left + rect.width / 2,
            top: rect.top + rect.height / 2
        };
    };

    const playerPos = getCharacterPosition(playerRef);
    const enemyPos = getCharacterPosition(enemyRef);
    const startPos = isPlayerSpell ? playerPos : enemyPos;
    const endPos = isPlayerSpell ? enemyPos : playerPos;

    const style = {
        '--start-x': `${startPos.left}px`,
        '--start-y': `${startPos.top}px`,
        '--end-x': `${endPos.left}px`,
        '--end-y': `${endPos.top}px`,
        left: startPos.left,
        top: startPos.top,
        transform: 'translate(-50%, -50%)'
    };

    return (
        <div className="fixed z-20 w-12 h-12 md:w-24 md:h-24 animate-[flyToTarget_1s_linear_forwards]" style={style}>
            <img src={spellImage} alt="Flying Spell" className="w-full h-full object-contain" />
        </div>
    );
};

function App() {
    // Game state
    const [gameState, setGameState] = useState(GAME_STATES.SPLASH);
    const [floor, setFloor] = useState(1);
    const [score, setScore] = useState(0);
    const [playerHP, setPlayerHP] = useState(MAX_PLAYER_HP);
    const [enemyHP, setEnemyHP] = useState(3);
    const [currentWord, setCurrentWord] = useState(null);

    // Round management
    const [roundState, setRoundState] = useState(ROUND_STATES.WAITING);
    const [timer, setTimer] = useState(ROUND_TIME);
    const [roundStartTime, setRoundStartTime] = useState(null);

    // Character animation states
    const [playerState, setPlayerState] = useState('default');
    const [enemyState, setEnemyState] = useState('default');
    const [flyingSpell, setFlyingSpell] = useState(null);

    // Pronunciation results
    const [pronunciationResult, setPronunciationResult] = useState(null);
    const [showPronunciationResult, setShowPronunciationResult] = useState(false);
    const isProcessingResultRef = useRef(false);

    // UI states
    const [splashProgress, setSplashProgress] = useState(0);
    const [menuFade, setMenuFade] = useState(true);
    const [hasStartedGame, setHasStartedGame] = useState(false);
    const [shouldAutoStart, setShouldAutoStart] = useState(false);
    const [recentlyUsedWords, setRecentlyUsedWords] = useState([]);
    const [isSurveyOpen, setIsSurveyOpen] = useState(false);
    const [urlParams, setUrlParams] = useState({});
    const [userId, setUserId] = useState(null);
    const [age, setAge] = useState(null);
    const [gameId, setGameId] = useState(null);
    const [gameSessionId, setGameSessionId] = useState(null);

    // Refs
    const sounds = useRef(null);
    const timerRef = useRef(null);
    const playerRef = useRef(null);
    const enemyRef = useRef(null);
    const roundTimeoutRef = useRef(null);

    // Pronunciation scoring setup with VAD
    const pronunciationHook = usePronunciationScoring({
        mode: 'vad',
        autoAnalyze: true,
        textToAnalyze: currentWord?.word || '',
        vadConfig: {
            silenceThreshold: -40,
            speechThreshold: -25,
            minSpeechDuration: 300,
            maxSilenceDuration: 2000,
            maxRecordingTime: 10000,
        },
        enableLogging: true,
        onAnalysisComplete: (result) => {
            console.log('🎯 VAD auto-analysis completed:', result);

            // Clear the round timeout since we got speech
            if (roundTimeoutRef.current) {
                clearTimeout(roundTimeoutRef.current);
                roundTimeoutRef.current = null;
                console.log('✅ Cleared round timeout due to VAD detection');
            }

            // Process result directly - handlePronunciationResult will set the flag
            handlePronunciationResult(result, 'VAD_AUTO_ANALYSIS');
        }
    });

    // Update textToAnalyze when currentWord changes
    useEffect(() => {
        if (currentWord?.word) {
            console.log('📝 Updated textToAnalyze to:', currentWord.word);
        }
    }, [currentWord?.word]);

    // Auto-start round when currentWord changes and shouldAutoStart is true
    useEffect(() => {
        console.log('🔍 Auto-start useEffect triggered:', {
            shouldAutoStart,
            currentWord: currentWord?.word,
            roundState,
            willAutoStart: shouldAutoStart && currentWord?.word && roundState === ROUND_STATES.WAITING
        });

        if (shouldAutoStart && currentWord?.word && roundState === ROUND_STATES.WAITING) {
            console.log('🚀 Auto-starting round due to currentWord change:', currentWord.word);
            setShouldAutoStart(false);
            setTimeout(() => {
                startRound();
            }, 100);
        }
    }, [currentWord?.word, shouldAutoStart, roundState]);

    const {
        isRecording,
        recordingBlob,
        isListening,
        isProcessing,
        lastResult,
        error: pronunciationError,
        startListening,
        stopListening,
        processPronunciation,
        clearBlob
    } = pronunciationHook;

    // Initialize sounds
    useEffect(() => {
        sounds.current = createSounds();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);
        };
    }, []);

    // Parse URL params once on mount
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const all = {};
            params.forEach((value, key) => {
                all[key] = value;
            });
            // Extract dedicated fields
            const extractedUserId = all.user_id ?? all.userId ?? null;
            const extractedAgeRaw = all.age ?? null;
            const extractedGameId = all.game_id ?? all.gameId ?? null;

            if (extractedUserId != null) setUserId(extractedUserId);
            if (extractedGameId != null) setGameId(extractedGameId);
            if (extractedAgeRaw != null) {
                const n = Number(extractedAgeRaw);
                setAge(Number.isFinite(n) ? n : extractedAgeRaw);
            }

            // Remove extracted keys from general params
            const { user_id, userId, age: ageKey, game_id, gameId, ...rest } = all;
            setUrlParams(rest);
        } catch (e) {
            // noop
        }
    }, []);

    // Example: verify supabase client exists (no network call)
    useEffect(() => {
        if (supabase) {
            // console.debug('Supabase client ready');
        }
    }, []);

    // Create a game_session row only when game actually starts
    useEffect(() => {
        const createSession = async () => {
            if (gameState !== GAME_STATES.INGAME) return;
            if (!userId || gameSessionId) return;

            const numericAge = Number.isFinite(Number(age)) ? Number(age) : null;
            const numericGameId = Number.isFinite(Number(gameId)) ? Number(gameId) : null;

            const payload = {
                user_id: userId,
                age: numericAge,
                game_id: numericGameId,
                start_time: new Date().toISOString(),
                score: 0,
                profile_data: urlParams || {}
            };

            try {
                const { data, error } = await supabase
                    .from('game_sessions')
                    .insert(payload)
                    .select('id')
                    .single();

                if (error) {
                    console.error('Failed to create game session:', error);
                    return;
                }

                setGameSessionId(data?.id || null);
                console.log('Created game session:', data?.id);
            } catch (err) {
                console.error('Unexpected error creating game session:', err);
            }
        };

        createSession();
    }, [gameState, userId, age, gameId, urlParams, gameSessionId]);

    // Open survey when game over ONLY if user hasn't completed survey for this game before
    useEffect(() => {
        const checkAndOpenSurvey = async () => {
            if (gameState !== GAME_STATES.GAMEOVER) {
                setIsSurveyOpen(false);
                return;
            }
            try {
                const numericGameId = Number.isFinite(Number(gameId)) ? Number(gameId) : null;

                // If we know the user and game, check historical completion
                if (userId && numericGameId != null) {
                    const { data: history, error: historyError } = await supabase
                        .from('game_sessions')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('game_id', numericGameId)
                        .eq('survey_completed', true)
                        .limit(1);

                    if (!historyError && Array.isArray(history) && history.length > 0) {
                        // User already completed survey for this game before → do not show
                        setIsSurveyOpen(false);
                        return;
                    }
                }

                // Fallback to current session's completion flag if available
                if (gameSessionId) {
                    const { data, error } = await supabase
                        .from('game_sessions')
                        .select('survey_completed')
                        .eq('id', gameSessionId)
                        .single();
                    if (!error) {
                        const completed = Boolean(data?.survey_completed);
                        setIsSurveyOpen(!completed);
                        return;
                    }
                }

                // Default: show if we couldn't verify completion
                setIsSurveyOpen(true);
            } catch (e) {
                setIsSurveyOpen(true);
            }
        };

        checkAndOpenSurvey();
    }, [gameState, gameSessionId, userId, gameId]);

    // When game ends, update end_time and final score on the session
    useEffect(() => {
        const markEndTime = async () => {
            if (gameState !== GAME_STATES.GAMEOVER || !gameSessionId) return;
            try {
                await supabase
                    .from('game_sessions')
                    .update({ end_time: new Date().toISOString(), score })
                    .eq('id', gameSessionId);
            } catch (e) {
                // noop
            }
        };
        markEndTime();
    }, [gameState, gameSessionId, score]);

    // Splash screen progress
    useEffect(() => {
        if (gameState === GAME_STATES.SPLASH) {
            const interval = setInterval(() => {
                setSplashProgress(prev => {
                    if (prev >= 100) {
                        clearInterval(interval);
                        setGameState(GAME_STATES.MENU);
                        return 100;
                    }
                    return prev + 2;
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [gameState]);

    // Menu fade animation
    useEffect(() => {
        if (gameState === GAME_STATES.MENU) {
            const interval = setInterval(() => {
                setMenuFade(prev => !prev);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [gameState]);

    // Timer countdown
    useEffect(() => {
        if (gameState === GAME_STATES.INGAME && roundState === ROUND_STATES.LISTENING && timer > 0) {
            timerRef.current = setTimeout(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (gameState === GAME_STATES.INGAME && roundState === ROUND_STATES.LISTENING && timer === 0) {
            // Time's up - process with no audio
            handleTimeUp();
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [timer, gameState, roundState]);

    // Keyboard handler
    useEffect(() => {
        const handleKeyPress = async (event) => {
            if (event.code === 'Space') {
                // If survey modal is open, let space behave normally (typing in inputs)
                if (isSurveyOpen) {
                    return;
                }
                event.preventDefault();
                await handleSpacePress();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [gameState, roundState, isSurveyOpen]);

    const handleSpacePress = async () => {
        sounds.current?.pop();

        switch (gameState) {
            case GAME_STATES.MENU:
                setGameState(GAME_STATES.TUTORIAL);
                break;
            case GAME_STATES.TUTORIAL:
                startGame();
                break;
            case GAME_STATES.INGAME:
                if (roundState === ROUND_STATES.WAITING) {
                    startRound();
                }
                break;
            case GAME_STATES.GAMEOVER:
                resetGame();
                break;
        }
    };

    const startGame = () => {
        // start a fresh session
        setGameSessionId(null);
        setGameState(GAME_STATES.INGAME);
        setFloor(1);
        setScore(0);
        setPlayerHP(MAX_PLAYER_HP);
        setEnemyHP(getEnemyMaxHP(1));
        setCurrentWord(getRandomWord(1));
        setRoundState(ROUND_STATES.WAITING);
        setTimer(ROUND_TIME);
        setPlayerState('default');
        setEnemyState('default');
        setFlyingSpell(null);
        setPronunciationResult(null);
        setShowPronunciationResult(false);
        isProcessingResultRef.current = false;
        setHasStartedGame(true); // Mark that game has started
    };

    const resetGame = () => {
        setGameState(GAME_STATES.MENU);
        setFloor(1);
        setScore(0);
        setPlayerHP(MAX_PLAYER_HP);
        setEnemyHP(3);
        setCurrentWord(null);
        setRoundState(ROUND_STATES.WAITING);
        setTimer(ROUND_TIME);
        setHasStartedGame(false); // Reset game started flag
        setShouldAutoStart(false); // Reset auto-start flag
        setRecentlyUsedWords([]); // Reset word history
    };

    const handleCloseSurvey = () => {
        setIsSurveyOpen(false);
    };

    const handlePlayAgain = () => {
        setIsSurveyOpen(false);
        startGame();
    };

    const getRandomWord = (floor) => {
        const difficulty = getWordDifficulty(floor);
        const availableWords = WORD_LIST.filter(w => w.diff <= difficulty);

        // Filter out recently used words to avoid repetition
        const unusedWords = availableWords.filter(w => !recentlyUsedWords.includes(w.word));

        // If all words have been used recently, use all available words
        const wordsToChooseFrom = unusedWords.length > 0 ? unusedWords : availableWords;

        const selectedWord = wordsToChooseFrom[Math.floor(Math.random() * wordsToChooseFrom.length)];

        // Add to recently used list and keep only last 10 words
        setRecentlyUsedWords(prev => {
            const updated = [selectedWord.word, ...prev.filter(w => w !== selectedWord.word)];
            return updated.slice(0, Math.min(10, Math.floor(availableWords.length / 2))); // Keep max 50% of available words
        });

        console.log('🎲 Selected word:', selectedWord.word, 'from', wordsToChooseFrom.length, 'options (difficulty ≤', difficulty + ')');

        return selectedWord;
    };

    const startRound = async () => {
        console.log('🚀 Starting new round with word:', currentWord?.word);

        // Clear any existing timeout first
        if (roundTimeoutRef.current) {
            clearTimeout(roundTimeoutRef.current);
            roundTimeoutRef.current = null;
        }

        setRoundState(ROUND_STATES.LISTENING);
        setTimer(ROUND_TIME);
        setRoundStartTime(Date.now());

        // Clear any previous results
        clearBlob();

        // Start VAD listening with pronunciation scoring
        if (startListening) {
            console.log('🎤 Starting VAD listening with pronunciation scoring...');
            await startListening();
        }

        // Set timeout for 10 seconds - if no speech detected, process anyway
        roundTimeoutRef.current = setTimeout(() => {
            console.log('⏰ 10 seconds timeout - processing without speech');
            if (roundTimeoutRef.current) {
                roundTimeoutRef.current = null;
                handleTimeUp();
            }
        }, ROUND_TIME * 1000);
    };

    const handleTimeUp = async () => {
        console.log('⏰ Time up - no speech detected', {
            roundState,
            isListening,
            currentWord: currentWord?.word
        });

        // Only process if we're still in listening state AND not already processing
        if (roundState !== ROUND_STATES.LISTENING || isProcessingResultRef.current) {
            console.log('⚠️ Ignoring timeout - not in correct state:', {
                roundState,
                isProcessingResult: isProcessingResultRef.current
            });
            return;
        }

        // Stop VAD listening
        if (isListening && stopListening) {
            console.log('🛑 Stopping VAD listening due to timeout...');
            await stopListening();
        }

        // Double check we're still not processing (race condition protection)
        if (isProcessingResultRef.current) {
            console.log('⚠️ Result processing started during timeout, aborting timeout handler');
            return;
        }

        setRoundState(ROUND_STATES.PROCESSING);

        // Process with no audio (failed pronunciation)
        const failResult = {
            total_score: 0,
            text_refs: currentWord.word,
            result: [{
                word: currentWord.word,
                letters: currentWord.word.split('').map(letter => ({
                    letter: letter.toLowerCase(),
                    score: 0
                }))
            }]
        };

        handlePronunciationResult(failResult, 'TIMEOUT_HANDLER');
    };



    const handlePronunciationResult = (result, source = 'unknown') => {
        console.log('🎯 Handling pronunciation result:', {
            source,
            result,
            totalScore: result.total_score,
            textRefs: result.text_refs,
            currentWord: currentWord?.word,
            roundState,
            isProcessingResult: isProcessingResultRef.current,
            timestamp: new Date().toISOString()
        });

        // Prevent multiple processing of results (synchronous check)
        if (isProcessingResultRef.current) {
            console.log('⚠️ Already processing a result, ignoring this one from:', source);
            return;
        }

        // Only process if we're still in listening state
        if (roundState !== ROUND_STATES.LISTENING && roundState !== ROUND_STATES.PROCESSING) {
            console.log('⚠️ Not in correct state for processing result:', roundState, 'from:', source);
            return;
        }

        // Verify result matches current word
        if (result.text_refs && currentWord?.word &&
            result.text_refs.toLowerCase() !== currentWord.word.toLowerCase()) {
            console.error('🚨 WORD MISMATCH! Ignoring result from:', source, {
                expected: currentWord.word,
                received: result.text_refs
            });
            return;
        }

        // Set processing flag to prevent duplicate processing (synchronous)
        console.log('✅ Processing result from:', source, '- Setting processing flag');
        isProcessingResultRef.current = true;
        setRoundState(ROUND_STATES.PROCESSING);

        setPronunciationResult(result);
        setShowPronunciationResult(true);

        const accuracy = (result.total_score || 0) * 100;
        let damage = 0;
        let baseScore = Math.floor(Math.random() * 4) + 5;
        let finalScore = 0;

        console.log('📊 Scoring calculation:', {
            totalScore: result.total_score,
            accuracy: accuracy,
            accuracyRounded: Math.round(accuracy)
        });

        if (accuracy >= 85) {
            // Perfect pronunciation (85% - 100%)
            damage = 2;
            finalScore = baseScore * 3;
            console.log('🎯 PERFECT! Damage:', damage, 'Score:', finalScore);
            sounds.current?.perfect();
            setCharacterState('player', 'attack', 1500);
            launchSpell('player');
            setTimeout(() => setCharacterState('enemy', 'hurt', 1000), 950);
        } else if (accuracy >= 60) {
            // Good pronunciation (60% - 84%)
            damage = 1;
            finalScore = baseScore;
            console.log('✅ GOOD! Damage:', damage, 'Score:', finalScore);
            sounds.current?.success();
            setCharacterState('player', 'attack', 1000);
            launchSpell('player');
            setTimeout(() => setCharacterState('enemy', 'hurt', 800), 950);
        } else {
            // Failed pronunciation (0% - 59%) - Monster attacks player
            damage = 0;
            finalScore = 0;
            console.log('❌ FAILED! Accuracy:', accuracy, '% - Monster attacks player');
            sounds.current?.fail();

            // Monster attack animation sequence
            setCharacterState('enemy', 'attack', 1000);
            launchSpell('enemy');
            setTimeout(() => {
                setCharacterState('player', 'hurt', 1000);
                setPlayerHP(prev => Math.max(0, prev - 1));
            }, 950); // Player gets hurt when spell hits
        }

        console.log('📊 Final damage calculation:', {
            accuracy,
            damage,
            finalScore,
            willContinue: true
        });

        // Apply damage and score
        if (damage > 0) {
            console.log('⚔️ PLAYER ATTACKS! Damage to enemy:', damage);
            const newEnemyHP = Math.max(0, enemyHP - damage);
            setEnemyHP(newEnemyHP);
            setScore(prev => prev + finalScore);

            console.log('🎯 Enemy HP:', enemyHP, '→', newEnemyHP);

            if (newEnemyHP === 0) {
                // Enemy defeated
                console.log('💀 Enemy defeated!');
                setCharacterState('enemy', 'dead');
                const victoryBonus = (getEnemyMaxHP(floor) * 10) + Math.ceil(floor * 0.1);
                setScore(prev => prev + victoryBonus);
                setTimeout(() => nextFloor(), 2000);
            } else {
                // Continue to next word
                console.log('➡️ Continue to next word');
                setTimeout(() => nextWord(), 2000);
            }
        } else {
            console.log('💔 PLAYER FAILED! Player takes damage. Current HP:', playerHP);
            if (playerHP <= 1) {
                // Player dies
                console.log('💀 Player dies! Game over in 2s...');
                setCharacterState('player', 'dead');
                setTimeout(() => {
                    console.log('💀 Executing game over...');
                    setGameState(GAME_STATES.GAMEOVER);
                }, 2000);
            } else {
                // Continue to next word
                console.log('➡️ Player survives, continue to next word in 2s...');
                setTimeout(() => {
                    console.log('🔄 Executing nextWord (failed case)...');
                    nextWord();
                }, 2000);
            }
        }

        setRoundState(ROUND_STATES.FINISHED);

        // Hide result after 3 seconds
        setTimeout(() => {
            setShowPronunciationResult(false);
            setPronunciationResult(null);
            console.log('🧹 Hiding pronunciation result');
        }, 3000);
    };

    const nextWord = async () => {
        console.log('🔄 Moving to next word');

        // Clean up any existing timeouts
        if (roundTimeoutRef.current) {
            clearTimeout(roundTimeoutRef.current);
            roundTimeoutRef.current = null;
        }

        // Stop any active VAD listening
        if (isListening && stopListening) {
            console.log('🛑 Stopping VAD for next word...');
            await stopListening();
        }

        // Clear previous results
        clearBlob();

        // Reset processing flag FIRST
        isProcessingResultRef.current = false;
        console.log('🔓 Reset processing flag to FALSE (nextWord)');

        const newWord = getRandomWord(floor);
        setCurrentWord(newWord);
        setRoundState(ROUND_STATES.WAITING);
        setTimer(ROUND_TIME);
        setPronunciationResult(null);
        setShowPronunciationResult(false);

        console.log('✅ Ready for next word:', newWord.word);

        // Set flag to auto-start when currentWord updates
        console.log('🏁 Setting shouldAutoStart = true for next word');
        setShouldAutoStart(true);
    };

    const nextFloor = () => {
        console.log('🏆 Moving to next floor');
        const newFloor = floor + 1;
        setFloor(newFloor);
        sounds.current?.levelUp();

        // Reset character states
        setPlayerState('default');
        setEnemyState('default');
        setFlyingSpell(null);

        // Heal on floors divisible by 5
        if (newFloor % 5 === 0) {
            if (playerHP < MAX_PLAYER_HP) {
                setPlayerHP(prev => Math.min(MAX_PLAYER_HP, prev + 1));
                sounds.current?.heal();
            } else {
                setScore(prev => prev + 10);
            }
        }

        setEnemyHP(getEnemyMaxHP(newFloor));
        const newWord = getRandomWord(newFloor);
        setCurrentWord(newWord);
        setRoundState(ROUND_STATES.WAITING);
        setTimer(ROUND_TIME);
        setPronunciationResult(null);
        setShowPronunciationResult(false);

        // Reset processing flag
        isProcessingResultRef.current = false;
        console.log('🔓 Reset processing flag to FALSE (nextFloor)');

        console.log('✅ Ready for floor', newFloor, 'with word:', newWord.word);

        // Set flag to auto-start when currentWord updates
        console.log('🏁 Setting shouldAutoStart = true for next floor');
        setShouldAutoStart(true);
    };

    const setCharacterState = (character, state, duration = 1000) => {
        if (character === 'player') {
            setPlayerState(state);
            if (state !== 'default' && state !== 'dead') {
                setTimeout(() => setPlayerState('default'), duration);
            }
        } else if (character === 'enemy') {
            setEnemyState(state);
            if (state !== 'default' && state !== 'dead') {
                setTimeout(() => setEnemyState('default'), duration);
            }
        }
    };

    const launchSpell = (caster) => {
        setFlyingSpell({ type: caster, active: true });
        setTimeout(() => setFlyingSpell(null), 1000);
    };

    // Render functions
    const renderSplash = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
            <h1 className="text-6xl font-bold mb-8 font-mono">ECHO TOWER</h1>
            <div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all duration-100" style={{ width: `${splashProgress}%` }} />
            </div>
            <p className="mt-4 text-xl">Loading... {splashProgress}%</p>
        </div>
    );

    const renderMenu = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
            <button
                onClick={() => { window.location.href = 'https://robot-record-web.hacknao.edu.vn/games'; }}
                className="fixed top-4 left-4 md:top-6 md:left-6 z-50 bg-gray-800/80 hover:bg-gray-700 text-white font-mono text-xs md:text-sm px-3 py-2 md:px-4 md:py-2 rounded border border-cyan-700 shadow"
            >
                ← Thoát game
            </button>
            <h1 className="text-4xl md:text-8xl font-bold mb-8 md:mb-16 font-mono">ECHO TOWER</h1>
            <p className={`text-xl md:text-2xl font-mono transition-opacity duration-500 ${menuFade ? 'opacity-100' : 'opacity-30'} hidden md:block`}>
                PRESS [SPACE] TO START
            </p>

            {/* Mobile Button for Menu */}
            <button
                onClick={handleSpacePress}
                className={`md:hidden bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-mono text-xl px-8 py-4 rounded-lg shadow-lg transition-opacity duration-500 ${menuFade ? 'opacity-100' : 'opacity-70'}`}
            >
                🚀 BẮT ĐẦU GAME
            </button>
        </div>
    );

    const renderTutorial = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400 p-8">
            <button
                onClick={() => { window.location.href = 'https://robot-record-web.hacknao.edu.vn/games'; }}
                className="fixed top-4 left-4 md:top-6 md:left-6 z-50 bg-gray-800/80 hover:bg-gray-700 text-white font-mono text-xs md:text-sm px-3 py-2 md:px-4 md:py-2 rounded border border-cyan-700 shadow"
            >
                ← Thoát game
            </button>
            <h2 className="text-4xl font-bold mb-8 font-mono">CÁCH CHƠI</h2>
            <div className="max-w-3xl text-center space-y-2 md:space-y-4 text-sm md:text-xl px-4">
                <p>🧙‍♂️ Bạn là một pháp sư leo lên Tháp Echo</p>
                <p>👹 Đánh bại quái vật bằng cách phát âm chính xác từ thần chú</p>
                <p>🎮 <span className="text-yellow-400">CÁCH CHƠI:</span></p>
                <p>1️⃣ <span className="hidden md:inline">Nhấn [SPACE]</span><span className="md:hidden">Nhấn nút</span> để bắt đầu vòng chơi</p>
                <p>2️⃣ Hệ thống đếm ngược 10 giây</p>
                <p>3️⃣ Nói từ bất cứ lúc nào - hệ thống tự động chấm điểm</p>
                <p>🎯 Phát âm hoàn hảo (85-100%): 2 sát thương, điểm x3</p>
                <p>✅ Phát âm thành công (60-85%): 1 sát thương, điểm thường</p>
                <p>❌ Phát âm thất bại (0-60%): Bạn mất 1 máu</p>
                <p>❤️ Hồi 1 máu ở các tầng chia hết cho 5</p>
                <p className="text-green-400 mt-8 hidden md:block">NHẤN [SPACE] ĐỂ BẮT ĐẦU HÀNH TRÌNH</p>

                {/* Mobile Button for Tutorial */}
                <button
                    onClick={handleSpacePress}
                    className="md:hidden bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-mono text-xl px-8 py-4 rounded-lg shadow-lg animate-pulse mt-8"
                >
                    ⚔️ BẮT ĐẦU HÀNH TRÌNH
                </button>
            </div>
        </div>
    );

    const renderGame = () => (
        <div className="min-h-screen bg-black text-cyan-400 p-2 md:p-4 flex flex-col">
            <button
                onClick={() => { window.location.href = 'https://robot-record-web.hacknao.edu.vn/games'; }}
                className="fixed top-14 left-4 md:top-24 md:left-8 z-50 bg-gray-800/80 hover:bg-gray-700 text-white font-mono text-xs md:text-sm px-3 py-2 md:px-4 md:py-2 rounded border border-cyan-700 shadow"
            >
                ← Thoát game
            </button>
            {/* Top HUD */}
            <div className="flex justify-between items-center mb-4 md:mb-8">
                <div className="flex items-center space-x-2 md:space-x-6">
                    <span className="text-sm md:text-2xl font-mono text-yellow-400">TẦNG: {floor}</span>
                    <span className="text-sm md:text-2xl font-mono text-green-400">ĐIỂM: {score}</span>
                </div>

                {/* Round Status in top right */}
                <div className={`text-xs md:text-2xl font-mono ${roundState === ROUND_STATES.PROCESSING ? 'text-yellow-400 animate-pulse' :
                    roundState === ROUND_STATES.LISTENING ? 'text-blue-400 animate-pulse' :
                        'text-gray-400'
                    }`}>
                    {roundState === ROUND_STATES.PROCESSING ? 'CHẤM ĐIỂM' :
                        roundState === ROUND_STATES.LISTENING ? 'ĐANG NGHE' :
                            roundState === ROUND_STATES.FINISHED ? 'HOÀN THÀNH' :
                                'CHỜ BẮT ĐẦU'}
                </div>
            </div>

            {/* Main Battle Area */}
            <div className="flex-1 flex flex-col">
                <div className="bg-gray-900 rounded-lg p-4 md:p-8 flex-1 flex flex-col">

                    {/* Battle Characters */}
                    <div className="flex-1 grid grid-cols-2 gap-4 md:gap-12 items-center">
                        {/* Player */}
                        <div className="flex flex-col items-center space-y-2 md:space-y-6">
                            <h3 className="text-sm md:text-2xl font-mono text-cyan-400">NGƯỜI CHƠI</h3>
                            <PlayerCharacter ref={playerRef} state={playerState} className="w-16 h-16 md:w-32 md:h-32" />
                            <div className="flex space-x-1 md:space-x-2">
                                {Array.from({ length: MAX_PLAYER_HP }, (_, i) => (
                                    <HeartIcon
                                        key={i}
                                        filled={i < playerHP}
                                        className={`w-4 h-4 md:w-10 md:h-10 ${i < playerHP ? 'text-red-500' : 'text-gray-600'}`}
                                    />
                                ))}
                            </div>
                            <div className="text-xs md:text-xl font-mono text-cyan-400">HP: {playerHP}/{MAX_PLAYER_HP}</div>
                        </div>

                        {/* Enemy */}
                        <div className="flex flex-col items-center space-y-2 md:space-y-6">
                            <h3 className="text-sm md:text-2xl font-mono text-red-500">QUÁI VẬT</h3>
                            <EnemyCharacter ref={enemyRef} state={enemyState} className="w-16 h-16 md:w-32 md:h-32" />
                            <div className="flex space-x-1 md:space-x-2">
                                {Array.from({ length: getEnemyMaxHP(floor) }, (_, i) => (
                                    <HeartIcon
                                        key={i}
                                        filled={i < enemyHP}
                                        className={`w-4 h-4 md:w-10 md:h-10 ${i < enemyHP ? 'text-red-500' : 'text-gray-600'}`}
                                    />
                                ))}
                            </div>
                            <div className="text-xs md:text-xl font-mono text-red-500">HP: {enemyHP}/{getEnemyMaxHP(floor)}</div>
                        </div>
                    </div>

                    {/* Current Word */}
                    {currentWord && (
                        <div className="text-center bg-yellow-900 border border-yellow-500 rounded-lg p-3 md:p-6 my-4 md:my-8 mx-auto max-w-xs md:max-w-md">
                            <h4 className="text-sm md:text-lg font-mono mb-1 md:mb-2 text-yellow-400">TỪ CẦN PHÁT ÂM:</h4>
                            <div className="text-2xl md:text-5xl font-bold text-yellow-300 font-mono mb-1 md:mb-2 break-all">
                                {currentWord.word}
                            </div>
                            <p className="text-xs md:text-sm text-yellow-600">
                                Độ khó: {currentWord.diff} | Loại: {currentWord.type} | Âm tiết: {currentWord.syllables}
                            </p>
                        </div>
                    )}

                    {/* Timer/Status */}
                    <div className="text-center mb-3 md:mb-6">
                        <div className={`text-3xl md:text-6xl font-mono font-bold ${roundState === ROUND_STATES.PROCESSING ? 'text-yellow-400 animate-pulse' :
                            roundState === ROUND_STATES.LISTENING && timer <= 5 ? 'text-red-500 animate-pulse' :
                                roundState === ROUND_STATES.LISTENING ? 'text-cyan-400' :
                                    'text-gray-400'
                            }`}>
                            {roundState === ROUND_STATES.PROCESSING ? 'CHẤM ĐIỂM' :
                                roundState === ROUND_STATES.LISTENING ? `${timer}s` :
                                    roundState === ROUND_STATES.FINISHED ? 'XONG' :
                                        'SẴN SÀNG'}
                        </div>
                        <p className="text-sm md:text-lg text-gray-400 mt-1 md:mt-2 px-2">
                            {roundState === ROUND_STATES.PROCESSING ? 'Đang xử lý âm thanh...' :
                                roundState === ROUND_STATES.LISTENING ? 'Hãy nói từ bất cứ lúc nào' :
                                    roundState === ROUND_STATES.FINISHED ? 'Vòng chơi hoàn thành' :
                                        hasStartedGame ? 'Chuẩn bị từ tiếp theo...' : 'Nhấn SPACE để bắt đầu'}
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="text-center text-sm md:text-lg font-mono mb-3 md:mb-6 px-2">
                        {roundState === ROUND_STATES.WAITING && !hasStartedGame && (
                            <p className="text-green-400 animate-pulse">NHẤN [SPACE] ĐỂ BẮT ĐẦU VÒNG CHƠI</p>
                        )}
                        {roundState === ROUND_STATES.WAITING && hasStartedGame && (
                            <p className="text-yellow-400">NHẤN [SPACE] ĐỂ BẮT ĐẦU VÒNG CHƠI</p>
                        )}
                        {roundState === ROUND_STATES.LISTENING && (
                            <div>
                                <p className="text-blue-400">NÓI TỪ BẤT CỨ LÚC NÀO - HỆ THỐNG SẼ TỰ ĐỘNG CHẤM ĐIỂM</p>
                                <p className="text-xs md:text-sm text-gray-400 mt-1 md:mt-2">
                                    VAD Status: {isListening ? '🎤 ĐANG NGHE' : '❌ KHÔNG HOẠT ĐỘNG'}
                                </p>
                            </div>
                        )}
                        {roundState === ROUND_STATES.PROCESSING && (
                            <p className="text-yellow-400 animate-pulse">ĐANG CHẤM ĐIỂM...</p>
                        )}
                        {roundState === ROUND_STATES.FINISHED && (
                            <p className="text-green-400">HOÀN THÀNH - CHUYỂN TỪ TIẾP THEO...</p>
                        )}
                    </div>

                    {/* Debug Controls */}
                    <div className="text-center mb-6">
                        <div className="flex justify-center space-x-4">

                        </div>
                    </div>

                    {/* Pronunciation Result */}
                    {showPronunciationResult && pronunciationResult && (
                        <div className="text-center bg-purple-900 border border-purple-500 rounded-lg p-3 md:p-4 mb-3 md:mb-6 mx-auto max-w-xs md:max-w-md">
                            <h4 className="text-sm md:text-lg font-mono mb-1 md:mb-2 text-purple-400">KẾT QUẢ PHÁT ÂM:</h4>
                            <div className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">
                                {Math.round((pronunciationResult.total_score || 0) * 100)}%
                            </div>
                            <p className="text-xs md:text-sm text-purple-300 mb-1 md:mb-2">
                                {(pronunciationResult.total_score || 0) >= 0.85 ? '🎯 HOÀN HẢO! (2 damage)' :
                                    (pronunciationResult.total_score || 0) >= 0.60 ? '✅ THÀNH CÔNG! (1 damage)' :
                                        '❌ THẤT BẠI! (Player mất máu)'}
                            </p>
                            <div className="text-xs text-gray-400 hidden md:block">
                                <p>Raw score: {pronunciationResult.total_score}</p>
                                <p>Word: {pronunciationResult.text_refs}</p>
                                <p>Expected: {currentWord?.word}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Flying Spell Effect */}
            <FlyingSpell flyingSpell={flyingSpell} playerRef={playerRef} enemyRef={enemyRef} />

            {/* Mobile Action Button */}
            <div className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
                {roundState === ROUND_STATES.WAITING && !hasStartedGame && (
                    <button
                        onClick={handleSpacePress}
                        className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-mono text-lg px-8 py-4 rounded-lg shadow-lg animate-pulse"
                    >
                        🚀 BẮT ĐẦU
                    </button>
                )}
                {roundState === ROUND_STATES.WAITING && hasStartedGame && (
                    <button
                        onClick={handleSpacePress}
                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-mono text-lg px-8 py-4 rounded-lg shadow-lg animate-pulse"
                    >
                        ▶️ TIẾP TỤC
                    </button>
                )}
                {roundState === ROUND_STATES.LISTENING && (
                    <div className="bg-blue-900 text-blue-200 font-mono text-sm px-6 py-3 rounded-lg shadow-lg border border-blue-500">
                        🎤 ĐANG NGHE...
                    </div>
                )}
                {roundState === ROUND_STATES.PROCESSING && (
                    <div className="bg-yellow-900 text-yellow-200 font-mono text-sm px-6 py-3 rounded-lg shadow-lg border border-yellow-500 animate-pulse">
                        ⏳ CHẤM ĐIỂM...
                    </div>
                )}
            </div>
        </div>
    );

    const renderGameOver = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
            <button
                onClick={() => { window.location.href = 'https://robot-record-web.hacknao.edu.vn/games'; }}
                className="fixed top-4 left-4 md:top-6 md:left-6 z-50 bg-gray-800/80 hover:bg-gray-700 text-white font-mono text-xs md:text-sm px-3 py-2 md:px-4 md:py-2 rounded border border-cyan-700 shadow"
            >
                ← Thoát game
            </button>
            <h2 className="text-6xl font-bold mb-8 font-mono text-red-500">KẾT THÚC GAME</h2>
            <div className="text-center space-y-4 text-2xl font-mono mb-8">
                <p>ĐIỂM CUỐI: <span className="text-yellow-400">{score}</span></p>
                <p>SỐ TẦNG ĐÃ LEO: <span className="text-green-400">{floor}</span></p>
                <div className="mt-8">
                    <h3 className="text-xl mb-4">XẾP HẠNG THÁP</h3>
                    <div className="space-y-2 text-lg">
                        <p className="text-yellow-400">🥇 ĐẠI PHÁP SƯ: 5000+</p>
                        <p className="text-gray-400">🥈 HỌC VIÊN: 2000+</p>
                        <p className="text-orange-400">🥉 TÂN BINH: 1000+</p>
                        <p className={score >= 5000 ? 'text-yellow-400 font-bold' :
                            score >= 2000 ? 'text-gray-400 font-bold' :
                                score >= 1000 ? 'text-orange-400 font-bold' : 'text-red-400'}>
                            XẾP HẠNG CỦA BẠN: {score >= 5000 ? 'ĐẠI PHÁP SƯ' :
                                score >= 2000 ? 'HỌC VIÊN' :
                                    score >= 1000 ? 'TÂN BINH' : 'MỚI BẮT ĐẦU'}
                        </p>
                    </div>
                </div>
            </div>
            <p className="text-xl font-mono animate-pulse hidden md:block">NHẤN [SPACE] ĐỂ QUAY VỀ MENU</p>

            {/* Mobile Button for Game Over */}
            <button
                onClick={handleSpacePress}
                className="md:hidden bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-mono text-lg px-8 py-4 rounded-lg shadow-lg animate-pulse mt-4"
            >
                🏠 QUAY VỀ MENU
            </button>
            {/* Survey Modal */}
            <SurveyModal
                isOpen={isSurveyOpen}
                onClose={handleCloseSurvey}
                onPlayAgain={handlePlayAgain}
                gameSessionId={gameSessionId}
                currentGameId={gameId}
                userId={userId}
                age={age}
                urlParams={urlParams}
            />
        </div>
    );

    // Main render
    switch (gameState) {
        case GAME_STATES.SPLASH:
            return renderSplash();
        case GAME_STATES.MENU:
            return renderMenu();
        case GAME_STATES.TUTORIAL:
            return renderTutorial();
        case GAME_STATES.INGAME:
            return renderGame();
        case GAME_STATES.GAMEOVER:
            return renderGameOver();
        default:
            return renderMenu();
    }
}

export default App;