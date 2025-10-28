import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useRecord } from './src/hooks/useRecord.js';
import { checkPronunciation } from './src/utils.js';

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
const ENEMY_ATTACK_TIME = 10;
const MAX_PLAYER_HP = 6; // Changed to 6 as per Vietnamese specs
const MAX_ENEMY_HP = 6;

const WORD_LIST = [
    { word: "CAT", diff: 1, syllables: 1, type: "n" },
    { word: "DOOR", diff: 1, syllables: 1, type: "n" },
    { word: "APPLE", diff: 2, syllables: 2, type: "n" },
    { word: "RUN", diff: 3, syllables: 1, type: "v" },
    { word: "TOWER", diff: 4, syllables: 2, type: "n" },
    { word: "BEAM", diff: 5, syllables: 1, type: "n" },
    { word: "MAGIC", diff: 5, syllables: 2, type: "n" },
    { word: "WIZARD", diff: 6, syllables: 2, type: "n" },
    { word: "PHANTOM", diff: 7, syllables: 2, type: "n" },
    { word: "BEAUTIFUL", diff: 8, syllables: 3, type: "adj" },
    { word: "EXTRAORDINARY", diff: 9, syllables: 5, type: "adj" },
    { word: "COMPLICATED", diff: 10, syllables: 4, type: "adj" },
];

// Game state enum
const GAME_STATES = {
    SPLASH: 'splash',
    MENU: 'menu',
    TUTORIAL: 'tutorial',
    INGAME: 'ingame',
    GAMEOVER: 'gameover'
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
const getLevelDifficulty = (floor) => Math.floor(floor / 10) + 1;
const getEnemyMaxHP = (floor) => Math.min(MAX_ENEMY_HP, 3 + Math.floor(floor / 5));
const getWordDifficulty = (floor) => Math.min(10, Math.floor(floor / 2) + 1);

// Flying Spell Projectile Component
const FlyingSpell = ({ flyingSpell, playerRef, enemyRef }) => {
    if (!flyingSpell || !flyingSpell.active) return null;

    const isPlayerSpell = flyingSpell.type === 'player';
    const spellImage = isPlayerSpell ? userSpellFire : monsterSpellFire;

    // Get actual positions of characters
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

    // Calculate start and end positions
    const startPos = isPlayerSpell ? playerPos : enemyPos;
    const endPos = isPlayerSpell ? enemyPos : playerPos;

    // Calculate distance and angle
    const deltaX = endPos.left - startPos.left;
    const deltaY = endPos.top - startPos.top;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Dynamic CSS variables for animation
    const style = {
        '--start-x': `${startPos.left}px`,
        '--start-y': `${startPos.top}px`,
        '--end-x': `${endPos.left}px`,
        '--end-y': `${endPos.top}px`,
        '--distance': `${distance}px`,
        left: startPos.left,
        top: startPos.top,
        transform: 'translate(-50%, -50%)'
    };

    const animationClass = isPlayerSpell
        ? 'animate-[flyToTarget_1s_linear_forwards]'
        : 'animate-[flyToTarget_1s_linear_forwards]';

    return (
        <div
            className={`fixed z-20 w-24 h-24 ${animationClass}`}
            style={style}
        >
            <img
                src={spellImage}
                alt="Flying Spell"
                className="w-full h-full object-contain"
            />
        </div>
    );
};

// Spell Effect Component (for casting animation)
const SpellEffect = ({ show, spellImage, className = "w-24 h-24" }) => {
    if (!show) return null;

    return (
        <div className={`${className} absolute animate-pulse`}>
            <img
                src={spellImage}
                alt="Spell Effect"
                className="w-full h-full object-contain opacity-60"
            />
        </div>
    );
};

// Character Components with State-based Assets
const PlayerCharacter = React.forwardRef(({ state, className = "w-32 h-32" }, ref) => {
    const getPlayerAsset = () => {
        switch (state) {
            case 'attack':
                return userAttack;
            case 'hurt':
                return userHurt;
            case 'dead':
                return userDead;
            default:
                return userDefault;
        }
    };

    return (
        <div ref={ref} className={`${className} flex items-center justify-center`}>
            <img
                src={getPlayerAsset()}
                alt={`Player ${state}`}
                className="w-full h-full object-contain"
            />
        </div>
    );
});

const EnemyCharacter = React.forwardRef(({ state, className = "w-32 h-32" }, ref) => {
    const getEnemyAsset = () => {
        switch (state) {
            case 'attack':
                return monsterAttack;
            case 'hurt':
                return monsterHurt;
            case 'dead':
                return monsterDead;
            default:
                return monsterDefault;
        }
    };

    return (
        <div ref={ref} className={`${className} flex items-center justify-center`}>
            <img
                src={getEnemyAsset()}
                alt={`Enemy ${state}`}
                className="w-full h-full object-contain"
            />
        </div>
    );
});

// Heart Icon for HP display
const HeartIcon = ({ filled, className = "w-8 h-8" }) => (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

// Pronunciation Result Display Component
const PronunciationDisplay = ({ word, pronunciationResult }) => {
    if (!pronunciationResult || !pronunciationResult.result || !pronunciationResult.result[0]) {
        // Fallback to normal word display
        return (
            <div className="text-5xl font-bold text-yellow-300 font-mono">
                {word}
            </div>
        );
    }

    const wordResult = pronunciationResult.result[0];
    const letters = wordResult.letters || [];

    const getLetterColor = (score) => {
        if (score >= 0.7) return 'text-green-400';
        if (score >= 0.5) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="text-5xl font-bold font-mono flex">
            {letters.map((letterData, index) => (
                <span
                    key={index}
                    className={`${getLetterColor(letterData.score)} transition-colors duration-300`}
                    title={`Score: ${(letterData.score * 100).toFixed(1)}%`}
                >
                    {letterData.letter.toUpperCase()}
                </span>
            ))}
        </div>
    );
};

// Score Display Component
const ScoreDisplay = ({ pronunciationResult }) => {
    if (!pronunciationResult || pronunciationResult.total_score === undefined) {
        return null;
    }

    const totalScore = Math.round(pronunciationResult.total_score * 100);
    const getScoreColor = () => {
        if (totalScore >= 70) return 'text-green-400';
        if (totalScore >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className={`text-2xl font-mono mt-2 ${getScoreColor()}`}>
            Điểm: {totalScore}%
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
    const [timer, setTimer] = useState(ENEMY_ATTACK_TIME);
    const [hint, setHint] = useState('');
    const [showHint, setShowHint] = useState(false);
    const [loadingTTS, setLoadingTTS] = useState(false);
    const [loadingHint, setLoadingHint] = useState(false);
    const [splashProgress, setSplashProgress] = useState(0);
    const [menuFade, setMenuFade] = useState(true);

    // Character animation states
    const [playerState, setPlayerState] = useState('default');
    const [enemyState, setEnemyState] = useState('default');

    // Removed static spell effect states - only using flying spells now

    // Flying spell projectile states
    const [flyingSpell, setFlyingSpell] = useState(null); // { type: 'player' | 'enemy', active: true }

    // VAD auto-stop handler using ref to avoid closure issues
    const vadAutoStopRef = useRef();
    vadAutoStopRef.current = async (blob) => {
        console.log('🎯 VAD auto-stopped, processing audio...', {
            hasBlob: !!blob,
            blobSize: blob?.size,
            blobType: blob?.type,
            currentWord: currentWord?.word,
            timestamp: new Date().toISOString()
        });
        
        if (blob && blob.size > 0) {
            console.log('✅ Calling processAudioBlob with valid blob');
            try {
                await processAudioBlob(blob);
            } catch (error) {
                console.error('❌ Error in processAudioBlob:', error);
                handleChantResultFallback('');
            }
        } else {
            console.log('❌ No valid blob, using fallback');
            handleChantResultFallback('');
        }
    };

    // Audio recording using useRecord hook with VAD
    const recordHookResult = useRecord({
        enableVAD: true, // Enable VAD auto-stop
        vadConfig: {
            silenceThreshold: -30,
            speechThreshold: -18,
            minSpeechDuration: 500, // Minimum 0.5s speech
            maxSilenceDuration: 3000, // 3 seconds silence to auto-stop
            maxRecordingTime: 10000, // Max 10s per recording
        },
        enableLogging: true,
        onAutoStop: (blob) => vadAutoStopRef.current?.(blob)
    });

    const [isRecording, recordingBlob, startRecording, stopRecording, vadMethods] = recordHookResult;
    const { isListening, vadError, startListening, stopListening } = vadMethods || {};
    
    const [isProcessingAudio, setIsProcessingAudio] = useState(false);

    // Pronunciation result states
    const [pronunciationResult, setPronunciationResult] = useState(null);
    const [showPronunciationResult, setShowPronunciationResult] = useState(false);

    // Track API requests to prevent race conditions
    const [activeApiRequest, setActiveApiRequest] = useState(null);

    // Track space key processing to prevent multiple presses
    const [isProcessingSpace, setIsProcessingSpace] = useState(false);

    // Refs
    const sounds = useRef(null);
    const timerRef = useRef(null);
    const recognitionRef = useRef(null);
    const hintTimeoutRef = useRef(null);
    const playerRef = useRef(null);
    const enemyRef = useRef(null);
    const recordingTimeoutRef = useRef(null);

    // Initialize sounds and speech recognition fallback
    useEffect(() => {
        sounds.current = createSounds();

        // Initialize speech recognition as fallback
        if ('webkitSpeechRecognition' in window) {
            recognitionRef.current = new window.webkitSpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-US';

            recognitionRef.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toUpperCase().trim();
                handleChantResultFallback(transcript);
            };

            recognitionRef.current.onerror = () => {
                handleChantResultFallback('');
            };

            recognitionRef.current.onend = () => {
                // Speech recognition ended
            };
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
            if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
        };
    }, []);

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

    // Game timer
    useEffect(() => {
        if (gameState === GAME_STATES.INGAME && timer > 0) {
            timerRef.current = setTimeout(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else if (gameState === GAME_STATES.INGAME && timer === 0) {
            handleTimeout();
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [timer, gameState]);

    // Keyboard handler
    useEffect(() => {
        const handleKeyPress = async (event) => {
            if (event.code === 'Space') {
                event.preventDefault();
                await handleSpacePress();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [gameState, isRecording, isProcessingAudio]);

    const handleSpacePress = async () => {
        if (isProcessingSpace) {
            console.log('⚠️ SPACE already being processed, ignoring');
            return;
        }

        setIsProcessingSpace(true);

        try {
            console.log('⌨️ SPACE pressed', {
                gameState,
                isRecording,
                isProcessingAudio
            });

            sounds.current?.pop();

            switch (gameState) {
                case GAME_STATES.MENU:
                    setGameState(GAME_STATES.TUTORIAL);
                    break;
                case GAME_STATES.TUTORIAL:
                    startGame();
                    break;
                case GAME_STATES.INGAME:
                    if (vadMethods) {
                        // VAD mode - toggle listening
                        if (isListening) {
                            console.log('🛑 SPACE: Stopping VAD listening...');
                            await stopListening();
                        } else {
                            console.log('👂 SPACE: Starting VAD listening...');
                            await startListening();
                        }
                    } else {
                        // Manual mode - toggle recording
                        if (isRecording) {
                            console.log('🛑 SPACE: Stopping recording...');
                            await stopRecordingManual();
                        } else if (!isProcessingAudio) {
                            console.log('▶️ SPACE: Starting recording...');
                            await startChanting();
                        } else {
                            console.log('⚠️ SPACE: Cannot start - processing audio');
                        }
                    }
                    break;
                case GAME_STATES.GAMEOVER:
                    resetGame();
                    break;
            }
        } catch (error) {
            console.error('❌ Error in handleSpacePress:', error);
        } finally {
            setIsProcessingSpace(false);
        }
    };

    const startGame = async () => {
        setGameState(GAME_STATES.INGAME);
        setFloor(1);
        setScore(0);
        setPlayerHP(MAX_PLAYER_HP);
        setEnemyHP(getEnemyMaxHP(1));
        setCurrentWord(getRandomWord(1));
        setTimer(ENEMY_ATTACK_TIME);
        // Reset character states
        setPlayerState('default');
        setEnemyState('default');
        setFlyingSpell(null);
        setPronunciationResult(null);
        setShowPronunciationResult(false);
        
        // Auto-start VAD listening when game starts
        if (vadMethods && startListening) {
            setTimeout(async () => {
                await startListening();
            }, 1000);
        }
    };

    const resetGame = async () => {
        // Stop VAD listening first
        if (vadMethods && isListening && stopListening) {
            await stopListening();
        }
        
        setGameState(GAME_STATES.MENU);
        setFloor(1);
        setScore(0);
        setPlayerHP(MAX_PLAYER_HP);
        setEnemyHP(3);
        setCurrentWord(null);
        setTimer(ENEMY_ATTACK_TIME);
        setHint('');
        setShowHint(false);
    };

    const getRandomWord = (floor) => {
        const difficulty = getWordDifficulty(floor);
        const availableWords = WORD_LIST.filter(w => w.diff <= difficulty);
        return availableWords[Math.floor(Math.random() * availableWords.length)];
    };

    const startChanting = async () => {
        console.log('🚀 startChanting called', {
            isRecording,
            isProcessingAudio,
            canStart: !isRecording && !isProcessingAudio
        });

        if (!isRecording && !isProcessingAudio) {
            console.log('🎤 Starting recording with useRecord hook');

            try {
                await startRecording();
                console.log('✅ startRecording completed');

                // Auto-stop recording after 5 seconds
                recordingTimeoutRef.current = setTimeout(async () => {
                    console.log('⏰ Auto-stop timeout triggered, isRecording:', isRecording);
                    if (isRecording) {
                        console.log('⏰ Auto-stopping recording after 5 seconds');
                        await handleStopRecording();
                    }
                }, 5000);

            } catch (error) {
                console.error('❌ Error starting recording:', error);
                // Fallback to speech recognition
                if (recognitionRef.current) {
                    console.log('🔄 Falling back to speech recognition');
                    recognitionRef.current.start();
                }
            }
        } else {
            console.log('⚠️ Cannot start recording', {
                isRecording,
                isProcessingAudio,
                reason: isRecording ? 'Already recording' : 'Processing audio'
            });

            if (recognitionRef.current && !isRecording) {
                // Fallback to speech recognition
                console.log('🔄 Using speech recognition fallback');
                recognitionRef.current.start();
            }
        }
    };

    const handleStopRecording = async () => {
        console.log('🛑 handleStopRecording called', { isRecording });

        if (!isRecording) {
            console.log('⚠️ Not recording, nothing to stop');
            return;
        }

        try {
            console.log('🛑 Calling stopRecording from hook...');
            const audioBlob = await stopRecording();
            console.log('✅ stopRecording completed, got blob:', {
                hasBlob: !!audioBlob,
                size: audioBlob?.size,
                type: audioBlob?.type
            });

            // Clear the timeout if it exists
            if (recordingTimeoutRef.current) {
                clearTimeout(recordingTimeoutRef.current);
                recordingTimeoutRef.current = null;
                console.log('🧹 Cleared auto-stop timeout');
            }

            // Process the audio blob
            if (audioBlob && audioBlob.size > 0) {
                console.log('🔄 Processing audio blob...');
                await processAudioBlob(audioBlob);
            } else {
                console.log('❌ No valid audio blob, using fallback');
                handleChantResultFallback('');
            }

        } catch (error) {
            console.error('❌ Error in handleStopRecording:', error);
            handleChantResultFallback('');
        }
    };

    const stopRecordingManual = async () => {
        // Stop speech recognition if it's running
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }

        // Stop audio recording
        if (isRecording) {
            await handleStopRecording();
        }
    };

    // Process audio blob and call pronunciation API
    const processAudioBlob = async (audioBlob) => {
        console.log('🔄 processAudioBlob called', {
            currentWord: currentWord?.word,
            audioBlobSize: audioBlob.size,
            audioBlobType: audioBlob.type,
            gameState,
            timestamp: new Date().toISOString()
        });

        if (!currentWord) {
            console.error('❌ No current word, skipping processing', {
                currentWord,
                gameState,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Check if blob has meaningful size
        if (audioBlob.size < 1000) { // Less than 1KB probably means no real audio
            console.log('⚠️ Audio blob too small, using fallback');
            handleChantResultFallback('');
            return;
        }

        setIsProcessingAudio(true);

        try {

            // Call pronunciation API with unique identifier
            const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const requestWord = currentWord.word;

            console.log('🚀 Starting API request:', {
                requestId,
                requestWord,
                timestamp: new Date().toISOString()
            });

            // Track this request
            setActiveApiRequest({ requestId, word: requestWord });

            const result = await checkPronunciation(audioBlob, requestWord, requestId);

            console.log('📥 API result received:', {
                requestId,
                requestWord,
                result,
                currentWordNow: currentWord?.word,
                wordChanged: requestWord !== currentWord?.word
            });

            // Check if this is still the active request and word hasn't changed
            if (requestWord !== currentWord?.word) {
                console.warn('🚨 WORD CHANGED DURING API CALL - IGNORING RESULT:', {
                    requestId,
                    requestWord,
                    currentWordNow: currentWord?.word
                });
                return; // Ignore this result
            }

            if (result) {
                // Process API result
                console.log('✅ Processing REAL API result for word:', requestWord, {
                    hasResult: !!result,
                    hasTotalScore: result.total_score !== undefined,
                    hasLetters: result.result?.[0]?.letters?.length > 0,
                    totalScore: result.total_score,
                    textRefs: result.text_refs
                });
                handlePronunciationResult(result);
            } else {
                // API failed, treat as failed pronunciation
                console.log('❌ API returned null, using MOCK fallback for word:', requestWord);
                handleChantResultFallback('');
            }
        } catch (error) {
            console.error('Error processing audio:', error);
            // Fallback to failed pronunciation
            handleChantResultFallback('');
        } finally {
            setIsProcessingAudio(false);
            setActiveApiRequest(null);
        }
    };

    // Handle pronunciation API result
    const handlePronunciationResult = (apiResult) => {
        if (!currentWord) return;

        console.log('🔍 handlePronunciationResult called', {
            currentWord: currentWord.word,
            apiResult: apiResult,
            isRealAPI: !apiResult.isMockData,
            timestamp: new Date().toISOString()
        });

        // Verify the API result matches current word
        const apiWord = apiResult.text_refs || (apiResult.result && apiResult.result[0] && apiResult.result[0].word);
        const wordsMatch = apiWord?.toLowerCase() === currentWord.word.toLowerCase();

        console.log('🔍 Word verification:', {
            apiWord,
            currentWord: currentWord.word,
            match: wordsMatch,
            timestamp: new Date().toISOString()
        });

        if (apiWord && !wordsMatch) {
            console.error('🚨 CRITICAL: API result word mismatch - REJECTING RESULT:', {
                apiWord,
                currentWord: currentWord.word,
                timestamp: new Date().toISOString()
            });
            // Use fallback if words don't match
            handleChantResultFallback('');
            return;
        }

        console.log('✅ Word verification passed, processing result for:', currentWord.word);

        // Store pronunciation result for display
        setPronunciationResult(apiResult);
        setShowPronunciationResult(true);

        // Extract accuracy from total_score * 100
        const accuracy = (apiResult.total_score || 0) * 100;
        console.log('Extracted accuracy:', accuracy);

        let damage = 0;
        let baseScore = Math.floor(Math.random() * 4) + 5; // Random 5-8 points
        let finalScore = 0;

        if (accuracy >= 85) {
            // Perfect pronunciation (85% - 100%)
            damage = 2; // Critical hit
            finalScore = baseScore * 3; // 3x multiplier
            sounds.current?.perfect();
            setCharacterState('player', 'attack', 1500);
            launchSpell('player');
            setTimeout(() => setCharacterState('enemy', 'hurt', 1000), 950);
        } else if (accuracy >= 60) {
            // Successful pronunciation (60% - 85%)
            damage = 1;
            finalScore = baseScore; // Normal score
            sounds.current?.success();
            setCharacterState('player', 'attack', 1000);
            launchSpell('player');
            setTimeout(() => setCharacterState('enemy', 'hurt', 800), 950);
        } else {
            // Failed pronunciation (0% - 60%)
            damage = 0;
            finalScore = 0;
            sounds.current?.fail();
            setCharacterState('player', 'hurt', 1000);
            setPlayerHP(prev => Math.max(0, prev - 1));
        }

        // Hide pronunciation result after 3 seconds
        setTimeout(() => {
            setShowPronunciationResult(false);
            setPronunciationResult(null);
        }, 3000);

        if (damage > 0) {
            const newEnemyHP = Math.max(0, enemyHP - damage);
            setEnemyHP(newEnemyHP);
            setScore(prev => prev + finalScore);

            if (newEnemyHP === 0) {
                // Enemy dies - go to next floor
                setCharacterState('enemy', 'dead');
                // Victory bonus: (Enemy Max HP x 10) + Math.ceil(Current Floor x 0.1)
                const victoryBonus = (getEnemyMaxHP(floor) * 10) + Math.ceil(floor * 0.1);
                setScore(prev => prev + victoryBonus);
                setTimeout(() => nextFloor(), 2000);
            } else {
                // Enemy still alive - get new word for next attack
                setTimeout(() => nextWord(), 1500); // Delay to show result first
            }
        } else {
            if (playerHP <= 1) {
                setCharacterState('player', 'dead');
                setTimeout(() => setGameState(GAME_STATES.GAMEOVER), 2000);
            } else {
                // Failed pronunciation - get new word to try again
                setTimeout(() => nextWord(), 1500);
            }
        }
    };

    // Fallback function for speech recognition or failed API calls
    const handleChantResultFallback = (transcript) => {
        if (!currentWord) return;

        console.log('handleChantResultFallback called', {
            transcript,
            currentWord: currentWord.word
        });

        const targetWord = currentWord.word;
        let accuracy = 0;

        // Simple text matching for fallback
        if (transcript === targetWord) {
            accuracy = 95; // Perfect match
        } else if (transcript.includes(targetWord) || targetWord.includes(transcript)) {
            accuracy = 70; // Partial match
        } else {
            // Random accuracy for demo when no real input
            accuracy = Math.random() * 100;
        }

        console.log('Fallback accuracy calculated:', accuracy);

        // Create mock API result with correct structure
        const mockResult = {
            total_score: accuracy / 100, // Convert to 0-1 range like real API
            text_refs: currentWord.word,
            isMockData: true, // Flag to identify mock data
            result: [{
                word: currentWord.word,
                letters: currentWord.word.split('').map((letter, index) => ({
                    letter: letter.toLowerCase(),
                    score: (accuracy / 100) + (Math.random() - 0.5) * 0.2, // Vary individual letter scores
                    start_time: index * 0.1,
                    end_time: (index + 1) * 0.1
                }))
            }]
        };

        console.log('Mock result created:', mockResult);

        // Use the same logic as API result
        handlePronunciationResult(mockResult);
    };



    const handleTimeout = () => {
        sounds.current?.damage();
        setCharacterState('enemy', 'attack', 1000);
        launchSpell('enemy');
        setTimeout(() => setCharacterState('player', 'hurt', 800), 950); // Hurt when spell hits

        const newPlayerHP = Math.max(0, playerHP - 1);
        setPlayerHP(newPlayerHP);

        if (newPlayerHP === 0) {
            setCharacterState('player', 'dead');
            setTimeout(() => setGameState(GAME_STATES.GAMEOVER), 2000);
        } else {
            // Player survived - get new word for next round
            setTimeout(() => nextWord(), 1500);
        }
    };

    const nextWord = async () => {
        // Generate new word for current floor
        const newWord = getRandomWord(floor);
        setCurrentWord(newWord);
        setTimer(ENEMY_ATTACK_TIME);

        // Reset pronunciation result
        setPronunciationResult(null);
        setShowPronunciationResult(false);

        console.log('🔄 Moving to next word:', newWord.word);

        // Restart VAD listening for new word after a short delay
        if (vadMethods && startListening) {
            setTimeout(async () => {
                if (gameState === GAME_STATES.INGAME) {
                    await startListening();
                }
            }, 1000);
        }
    };

    const nextFloor = async () => {
        const newFloor = floor + 1;
        setFloor(newFloor);
        sounds.current?.levelUp();

        // Reset character states for new floor
        setPlayerState('default');
        setEnemyState('default');
        setFlyingSpell(null);
        setPronunciationResult(null);
        setShowPronunciationResult(false);

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
        setTimer(ENEMY_ATTACK_TIME);

        console.log('🏆 Moving to floor:', newFloor, 'with word:', newWord.word);

        // Restart VAD listening for new floor after a short delay
        if (vadMethods && startListening) {
            setTimeout(async () => {
                if (gameState === GAME_STATES.INGAME) {
                    await startListening();
                }
            }, 2000);
        }
    };

    // API placeholder functions
    const handleTTS = async () => {
        if (!currentWord || loadingTTS) return;

        setLoadingTTS(true);
        try {
            // Placeholder for Gemini TTS API call
            // const response = await fetch('/api/tts', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ text: currentWord.word, model: 'gemini-2.5-flash-preview-tts' })
            // });

            // Mock delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // For now, use browser speech synthesis as fallback
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(currentWord.word);
                speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error('TTS Error:', error);
        } finally {
            setLoadingTTS(false);
        }
    };

    const handleHint = async () => {
        if (!currentWord || loadingHint || showHint) return;

        setLoadingHint(true);
        try {
            // Placeholder for Gemini LLM API call
            // const response = await fetch('/api/hint', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ 
            //     word: currentWord.word, 
            //     model: 'gemini-2.5-flash-preview-09-2025',
            //     prompt: `Generate a simple Vietnamese definition and pronunciation hint for the English word "${currentWord.word}"`
            //   })
            // });

            // Mock delay and response
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Mock Vietnamese hint
            const mockHints = {
                'CAT': 'Con mèo - phát âm: /kæt/',
                'DOOR': 'Cửa ra vào - phát âm: /dɔːr/',
                'APPLE': 'Quả táo - phát âm: /ˈæpəl/',
                'RUN': 'Chạy - phát âm: /rʌn/',
                'TOWER': 'Tòa tháp - phát âm: /ˈtaʊər/',
                'BEAM': 'Tia sáng - phát âm: /biːm/',
                'MAGIC': 'Phép thuật - phát âm: /ˈmædʒɪk/',
                'WIZARD': 'Phù thủy - phát âm: /ˈwɪzərd/',
                'PHANTOM': 'Bóng ma - phát âm: /ˈfæntəm/',
                'BEAUTIFUL': 'Đẹp - phát âm: /ˈbjuːtɪfəl/',
                'EXTRAORDINARY': 'Phi thường - phát âm: /ɪkˈstrɔːrdəneri/',
                'COMPLICATED': 'Phức tạp - phát âm: /ˈkɒmplɪkeɪtɪd/'
            };

            setHint(mockHints[currentWord.word] || 'Không có gợi ý');
            setShowHint(true);

            // Hide hint after 8 seconds
            hintTimeoutRef.current = setTimeout(() => {
                setShowHint(false);
                setHint('');
            }, 8000);

        } catch (error) {
            console.error('Hint Error:', error);
        } finally {
            setLoadingHint(false);
        }
    };

    const canUseHint = playerHP < MAX_PLAYER_HP || floor >= 3;

    // Animation state management
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

    // Removed showSpellEffect function - only using flying spells now

    // Flying spell projectile management
    const launchSpell = (caster) => {
        // Launch flying projectile immediately
        setFlyingSpell({ type: caster, active: true });

        // Remove flying spell after animation completes (1 second)
        setTimeout(() => {
            setFlyingSpell(null);
        }, 1000);
    };

    // Render functions
    const renderSplash = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
            <h1 className="text-6xl font-bold mb-8 font-mono">ECHO TOWER</h1>
            <div className="w-64 h-4 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-cyan-400 transition-all duration-100"
                    style={{ width: `${splashProgress}%` }}
                />
            </div>
            <p className="mt-4 text-xl">Loading... {splashProgress}%</p>
        </div>
    );

    const renderMenu = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
            <h1 className="text-8xl font-bold mb-16 font-mono">ECHO TOWER</h1>
            <p
                className={`text-2xl font-mono transition-opacity duration-500 ${menuFade ? 'opacity-100' : 'opacity-30'
                    }`}
            >
                PRESS [SPACE] TO START
            </p>
        </div>
    );

    const renderTutorial = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400 p-8">
            <h2 className="text-4xl font-bold mb-8 font-mono">CÁCH CHƠI</h2>
            <div className="max-w-3xl text-center space-y-4 text-xl">
                <p>🧙‍♂️ Bạn là một pháp sư leo lên Tháp Echo</p>
                <p>👹 Đánh bại quái vật bằng cách phát âm chính xác từ thần chú</p>
                <p>🎤 <span className="text-yellow-400">VAD TỰ ĐỘNG:</span> Hệ thống sẽ tự động nghe và chấm điểm</p>
                <p>⏰ Bạn có 10 giây trước khi quái vật tấn công</p>
                <p>🗣️ Chỉ cần nói từ khi sẵn sàng - hệ thống tự động phát hiện</p>
                <p>🤐 Sau 3 giây im lặng, hệ thống sẽ tự động chấm điểm</p>
                <p>🎯 Phát âm hoàn hảo (85-100%): 2 sát thương, điểm x3</p>
                <p>✅ Phát âm thành công (60-85%): 1 sát thương, điểm thường</p>
                <p>❌ Phát âm thất bại (0-60%): Bạn mất 1 máu</p>
                <p>❤️ Hồi 1 máu ở các tầng chia hết cho 5</p>
                <p>🏆 Điểm thưởng chiến thắng: (HP Quái x 10) + (Tầng x 0.1)</p>
                <p className="text-green-400 mt-8">NHẤN [SPACE] ĐỂ BẮT ĐẦU HÀNH TRÌNH</p>
            </div>
        </div>
    );

    const renderGame = () => (
        <div className="min-h-screen bg-black text-cyan-400 p-4 flex flex-col">
            {/* Top HUD */}
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center space-x-6">
                    <span className="text-2xl font-mono text-yellow-400">TẦNG: {floor}</span>
                    <span className="text-2xl font-mono text-green-400">ĐIỂM: {score}</span>
                </div>

                {/* Timer/Status in top right */}
                <div className={`text-4xl font-mono ${timer <= 5 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                    {isRecording ? 'ĐANG GHI ÂM...' : 
                     (vadMethods && isListening) ? 'ĐANG NGHE...' : 
                     `${timer}s`}
                </div>
            </div>

            {/* Main Battle Card - Single Card Layout */}
            <div className="flex-1 flex flex-col">
                <div className="bg-gray-900 rounded-lg p-8 flex-1 flex flex-col">

                    {/* Battle Area - Player vs Enemy */}
                    <div className="flex-1 grid grid-cols-2 gap-12 items-center">

                        {/* Left Side - Player */}
                        <div className="flex flex-col items-center space-y-6">
                            <h3 className="text-2xl font-mono text-cyan-400">NGƯỜI CHƠI</h3>

                            {/* Player Avatar */}
                            <PlayerCharacter
                                ref={playerRef}
                                state={playerState}
                                className={`w-32 h-32 ${isRecording ? 'animate-pulse' : ''}`}
                            />

                            {/* Player HP - Hearts */}
                            <div className="flex space-x-2">
                                {Array.from({ length: MAX_PLAYER_HP }, (_, i) => (
                                    <HeartIcon
                                        key={i}
                                        filled={i < playerHP}
                                        className={`w-10 h-10 ${i < playerHP ? 'text-red-500' : 'text-gray-600'}`}
                                    />
                                ))}
                            </div>

                            <div className="text-xl font-mono text-cyan-400">
                                HP: {playerHP}/{MAX_PLAYER_HP}
                            </div>
                        </div>

                        {/* Right Side - Enemy */}
                        <div className="flex flex-col items-center space-y-6">
                            <h3 className="text-2xl font-mono text-red-500">QUÁI VẬT</h3>

                            {/* Enemy Avatar */}
                            <EnemyCharacter
                                ref={enemyRef}
                                state={enemyState}
                                className={`w-32 h-32 ${timer <= 5 && enemyState === 'default' ? 'animate-pulse' : ''}`}
                            />

                            {/* Enemy HP - Hearts */}
                            <div className="flex space-x-2">
                                {Array.from({ length: getEnemyMaxHP(floor) }, (_, i) => (
                                    <HeartIcon
                                        key={i}
                                        filled={i < enemyHP}
                                        className={`w-10 h-10 ${i < enemyHP ? 'text-red-500' : 'text-gray-600'}`}
                                    />
                                ))}
                            </div>

                            <div className="text-xl font-mono text-red-500">
                                HP: {enemyHP}/{getEnemyMaxHP(floor)}
                            </div>
                        </div>
                    </div>

                    {/* Current Word Target - Center */}
                    {currentWord && (
                        <div className="text-center bg-yellow-900 border border-yellow-500 rounded-lg p-6 my-8 mx-auto max-w-md">
                            <h4 className="text-lg font-mono mb-2 text-yellow-400">TỪ CẦN PHÁT ÂM:</h4>
                            <div className="mb-2">
                                {showPronunciationResult ? (
                                    <div>
                                        <PronunciationDisplay
                                            word={currentWord.word}
                                            pronunciationResult={pronunciationResult}
                                        />
                                        <ScoreDisplay pronunciationResult={pronunciationResult} />
                                    </div>
                                ) : (
                                    <div className="text-5xl font-bold text-yellow-300 font-mono">
                                        {currentWord.word}
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-yellow-600">
                                Độ khó: {currentWord.diff} | Loại: {currentWord.type} | Âm tiết: {currentWord.syllables}
                            </p>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="text-center text-lg font-mono mb-6">
                        <p className={
                            isProcessingAudio ? 'text-yellow-400 animate-pulse' :
                                isRecording ? 'text-green-400 animate-pulse' :
                                    (vadMethods && isListening) ? 'text-blue-400 animate-pulse' :
                                        'text-cyan-400'
                        }>
                            {isProcessingAudio ? 'ĐANG CHẤM ĐIỂM...' :
                                isRecording ? 'ĐANG GHI ÂM - HÃY NÓI TỪ!' :
                                    (vadMethods && isListening) ? 'ĐANG NGHE - HÃY NÓI TỪ KHI SẴN SÀNG' :
                                        vadMethods ? 'NHẤN [SPACE] ĐỂ BẮT ĐẦU NGHE VAD' :
                                            'NHẤN [SPACE] ĐỂ BẮT ĐẦU THU ÂM'}
                        </p>
                        {vadMethods && isListening && (
                            <p className="text-sm text-gray-400 mt-2">
                                VAD sẽ tự động phát hiện giọng nói và chấm điểm sau 3 giây im lặng
                            </p>
                        )}
                    </div>

                    {/* Action Buttons - Bottom Center */}
                    <div className="flex justify-center space-x-6">
                        <button
                            onClick={handleTTS}
                            disabled={loadingTTS}
                            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-mono rounded-lg transition-colors text-lg"
                        >
                            {loadingTTS ? 'ĐANG TẢI...' : '🔊 NGHE TỪ'}
                        </button>

                        {canUseHint && (
                            <button
                                onClick={handleHint}
                                disabled={loadingHint || showHint}
                                className="px-8 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-mono rounded-lg transition-colors text-lg"
                            >
                                {loadingHint ? 'ĐANG TẢI...' : '💡 GỢI Ý'}
                            </button>
                        )}

                        {/* Debug buttons for testing */}
                        <div className="flex space-x-2">
                            <button
                                onClick={async () => {
                                    console.log('🔧 DEBUG: Toggle VAD/Recording');
                                    if (vadMethods) {
                                        if (isListening) {
                                            await stopListening();
                                        } else {
                                            await startListening();
                                        }
                                    } else {
                                        if (isRecording) {
                                            await stopRecordingManual();
                                        } else {
                                            await startChanting();
                                        }
                                    }
                                }}
                                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-mono rounded text-sm"
                            >
                                🔧 {vadMethods ? (isListening ? 'STOP VAD' : 'START VAD') : (isRecording ? 'STOP' : 'REC')}
                            </button>

                            <button
                                onClick={() => {
                                    console.log('🔧 DEBUG: Force using REAL API data');
                                    if (currentWord) {
                                        // Simulate real API response
                                        const realApiData = {
                                            total_score: 0.75,
                                            text_refs: currentWord.word,
                                            result: [{
                                                word: currentWord.word,
                                                letters: currentWord.word.split('').map((letter, index) => ({
                                                    letter: letter.toLowerCase(),
                                                    score: 0.7 + Math.random() * 0.3,
                                                    start_time: index * 0.1,
                                                    end_time: (index + 1) * 0.1
                                                }))
                                            }]
                                        };
                                        console.log('🔧 Simulating real API data:', realApiData);
                                        handlePronunciationResult(realApiData);
                                    }
                                }}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-mono rounded text-sm"
                            >
                                🔧 API
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Flying Spell Effect */}
            <FlyingSpell
                flyingSpell={flyingSpell}
                playerRef={playerRef}
                enemyRef={enemyRef}
            />

            {/* Hint Display - Bottom Center */}
            {showHint && hint && (
                <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-purple-900 border border-purple-500 rounded-lg p-4 max-w-md text-center z-10">
                    <p className="text-purple-200 text-lg">{hint}</p>
                </div>
            )}
        </div>
    );

    const renderGameOver = () => (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-cyan-400">
            <h2 className="text-6xl font-bold mb-8 font-mono text-red-500">KẾT THÚC GAME</h2>

            <div className="text-center space-y-4 text-2xl font-mono mb-8">
                <p>ĐIỂM CUỐI: <span className="text-yellow-400">{score}</span></p>
                <p>SỐ TẦNG ĐÃ LEO: <span className="text-green-400">{floor}</span></p>

                {/* Mock Rank */}
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

            <p className="text-xl font-mono animate-pulse">NHẤN [SPACE] ĐỂ QUAY VỀ MENU</p>
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