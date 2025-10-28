import { useRef, useState, useEffect, useCallback } from 'react'

export const useRecord = (config = {}) => {
    // Configuration with defaults
    const {
        enableVAD = false, // Enable VAD auto-stop
        vadConfig = {
            silenceThreshold: -30,
            speechThreshold: -18,
            minSpeechDuration: 500, // Minimum 0.5s speech
            maxSilenceDuration: 3000, // 3 seconds silence to auto-stop
            maxRecordingTime: 10000, // Max 10s per recording
        },
        recordingConfig = {
            mimeType: 'audio/wav',
            numberOfAudioChannels: 1,
            desiredSampRate: 16000,
            bufferSize: 4096
        },
        enableLogging = true,
        onAutoStop = null // Callback when VAD auto-stops
    } = config;

    const recorderRef = useRef(null)
    const streamRef = useRef(null)
    const analyserRef = useRef(null)
    const audioContextRef = useRef(null)
    const vadIntervalRef = useRef(null)
    const maxRecordingTimeoutRef = useRef(null)

    // VAD tracking refs
    const speechStartTimeRef = useRef(null)
    const lastSpeechTimeRef = useRef(null)
    const noiseFloorRef = useRef(-30)
    const audioLevelsRef = useRef([])
    const recordingStartTimeRef = useRef(null)

    const [isRecording, setIsRecording] = useState(false)
    const [recordingBlob, setRecordingBlob] = useState(null)
    const [isListening, setIsListening] = useState(false) // VAD listening state
    const [vadError, setVadError] = useState(null)
    const [forceStop, setForceStop] = useState(false)

    const log = useCallback((...args) => {
        if (enableLogging) {
            console.log(...args);
        }
    }, [enableLogging]);

    // Debug state changes
    useEffect(() => {
        log('🎤 useRecord state changed:', { isRecording, isListening, enableVAD });
    }, [isRecording, isListening, enableVAD, log]);

    // Pre-warm audio context for VAD
    useEffect(() => {
        const handleFirstInteraction = () => {
            if (!audioContextRef.current && enableVAD) {
                log('🔥 Pre-warming audio context for VAD...');
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume();
                }
            }
        };

        if (enableVAD) {
            document.addEventListener('click', handleFirstInteraction, { once: true });
            document.addEventListener('keydown', handleFirstInteraction, { once: true });
        }

        return () => {
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('keydown', handleFirstInteraction);
        };
    }, [enableVAD, log]);

    // Initialize audio resources for VAD
    const initializeAudio = useCallback(async () => {
        if (streamRef.current && (!enableVAD || (audioContextRef.current && analyserRef.current))) {
            log('🔄 Audio already initialized, reusing...');
            return streamRef.current;
        }

        try {
            log('🎙️ Initializing microphone and audio context...');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            streamRef.current = stream;

            // Setup VAD audio analysis if enabled
            if (enableVAD) {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                }

                if (audioContextRef.current.state === 'suspended') {
                    await audioContextRef.current.resume();
                }

                const source = audioContextRef.current.createMediaStreamSource(stream);
                analyserRef.current = audioContextRef.current.createAnalyser();

                analyserRef.current.fftSize = 256;
                analyserRef.current.smoothingTimeConstant = 0.8;

                source.connect(analyserRef.current);
            }

            log('✅ Audio initialized successfully');
            return stream;
        } catch (error) {
            log('❌ Error initializing audio:', error);
            setVadError(error.message);
            throw error;
        }
    }, [enableVAD, log]);

    // Get audio level in dB for VAD
    const getAudioLevel = useCallback(() => {
        if (!analyserRef.current) {
            return -100;
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;

        const dB = 20 * Math.log10(average / 255);
        return dB;
    }, []);

    // VAD processing loop
    const processVAD = useCallback(() => {
        if (!enableVAD || !isRecording) return;

        const audioLevel = getAudioLevel();
        const now = Date.now();

        audioLevelsRef.current.push(audioLevel);
        if (audioLevelsRef.current.length > 50) {
            audioLevelsRef.current.shift();
        }

        // Calculate adaptive noise floor
        if (audioLevelsRef.current.length >= 20) {
            const sortedLevels = [...audioLevelsRef.current].sort((a, b) => a - b);
            const noiseFloorSamples = sortedLevels.slice(0, Math.floor(sortedLevels.length * 0.3));
            noiseFloorRef.current = noiseFloorSamples.reduce((sum, level) => sum + level, 0) / noiseFloorSamples.length;
        }

        const adaptiveSpeechThreshold = noiseFloorRef.current + 12; // More sensitive for speech detection

        if (audioLevel > adaptiveSpeechThreshold) {
            // Speech detected
            if (!speechStartTimeRef.current) {
                speechStartTimeRef.current = now;
                log('🗣️ Speech started, level:', audioLevel.toFixed(1), 'dB');
            }
            lastSpeechTimeRef.current = now;
        } else {
            // Silence detected
            if (speechStartTimeRef.current && lastSpeechTimeRef.current) {
                const silenceDuration = now - lastSpeechTimeRef.current;
                const speechDuration = lastSpeechTimeRef.current - speechStartTimeRef.current;

                // Check if we should stop recording due to silence
                if (silenceDuration > vadConfig.maxSilenceDuration && speechDuration > vadConfig.minSpeechDuration) {
                    log('🤐 Auto-stopping recording due to silence:', {
                        silenceDuration,
                        speechDuration,
                        timestamp: new Date().toISOString()
                    });
                    setForceStop(true);
                }
            }
        }
    }, [enableVAD, isRecording, getAudioLevel, vadConfig.maxSilenceDuration, vadConfig.minSpeechDuration, log]);

    // Handle force stop from VAD
    useEffect(() => {
        if (forceStop && isRecording) {
            log('🛑 Force stopping recording due to VAD');
            stopRecording().then((blob) => {
                log('✅ VAD auto-stop completed', {
                    hasBlob: !!blob,
                    blobSize: blob?.size,
                    blobType: blob?.type,
                    hasCallback: !!onAutoStop,
                    timestamp: new Date().toISOString()
                });
                setForceStop(false);
                if (onAutoStop) {
                    log('🚀 Calling onAutoStop callback with blob');
                    try {
                        onAutoStop(blob);
                        log('✅ onAutoStop callback completed successfully');
                    } catch (error) {
                        log('❌ Error in onAutoStop callback:', error);
                    }
                } else {
                    log('⚠️ No onAutoStop callback provided');
                }
            });
        }
    }, [forceStop, isRecording, onAutoStop, log]);

    // Start/stop VAD processing
    useEffect(() => {
        if (isListening && enableVAD) {
            log('🔄 Starting VAD processing loop...');
            vadIntervalRef.current = setInterval(processVAD, 100); // Check every 100ms
        } else {
            if (vadIntervalRef.current) {
                log('🔄 Stopping VAD processing loop...');
                clearInterval(vadIntervalRef.current);
                vadIntervalRef.current = null;
            }
        }

        return () => {
            if (vadIntervalRef.current) {
                clearInterval(vadIntervalRef.current);
                vadIntervalRef.current = null;
            }
        };
    }, [isListening, enableVAD, processVAD, log]);

    // Start VAD listening (for VAD mode)
    const startListening = useCallback(async () => {
        if (!enableVAD) {
            log('⚠️ startListening called but VAD is not enabled');
            return;
        }

        try {
            setVadError(null);
            log('👂 Starting VAD listening...');

            await initializeAudio();
            setIsListening(true);

            // Auto-start recording after a short delay
            setTimeout(() => {
                if (!isRecording) {
                    log('🎤 Auto-starting recording for VAD mode');
                    startRecording();
                }
            }, 100);

            log('✅ VAD listening started successfully');

        } catch (error) {
            log('❌ Error starting VAD listening:', error);
            setVadError(error.message);
            alert('Error starting VAD: ' + error.message);
        }
    }, [enableVAD, initializeAudio, isRecording, log]);

    // Stop VAD listening
    const stopListening = useCallback(async () => {
        try {
            log('🛑 Stopping VAD listening...');

            if (vadIntervalRef.current) {
                clearInterval(vadIntervalRef.current);
                vadIntervalRef.current = null;
            }

            if (isRecording) {
                await stopRecording();
            }

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => {
                    log('🔇 Stopping track:', track.kind, track.label);
                    track.stop();
                });
                streamRef.current = null;
            }

            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }

            analyserRef.current = null;
            setIsListening(false);

            log('✅ VAD listening stopped successfully');
        } catch (error) {
            log('❌ Error stopping VAD listening:', error);
        }
    }, [isRecording, log]);

    const startRecording = async () => {
        log('🎤 startRecording called', {
            isCurrentlyRecording: isRecording,
            hasStream: !!streamRef.current,
            hasRecorder: !!recorderRef.current,
            enableVAD
        })

        if (isRecording) {
            log('⚠️ Already recording, ignoring start request')
            return
        }

        if (typeof window === 'undefined' || !navigator?.mediaDevices) {
            alert('Trình duyệt của bạn không hỗ trợ ghi âm')
            return
        }

        try {
            log('📦 Loading RecordRTC...')
            const { default: RecordRTC } = await import('recordrtc')

            // Initialize audio (will reuse existing stream if available)
            const stream = await initializeAudio();

            recorderRef.current = new RecordRTC(stream, {
                type: 'audio',
                mimeType: recordingConfig.mimeType,
                recorderType: RecordRTC.StereoAudioRecorder,
                numberOfAudioChannels: recordingConfig.numberOfAudioChannels,
                desiredSampRate: recordingConfig.desiredSampRate,
                bufferSize: recordingConfig.bufferSize,
            })

            log('▶️ Starting recording...')
            setRecordingBlob(null)
            recorderRef.current.startRecording()
            setIsRecording(true)

            // Reset VAD tracking
            speechStartTimeRef.current = null
            lastSpeechTimeRef.current = null
            recordingStartTimeRef.current = Date.now()

            // Set timeout for max recording time
            if (enableVAD) {
                maxRecordingTimeoutRef.current = setTimeout(() => {
                    log('⏰ Max recording timeout reached, forcing stop');
                    setForceStop(true);
                }, vadConfig.maxRecordingTime);
            }

            log('✅ Recording started successfully')
        } catch (error) {
            log('❌ Error starting recording:', error)
            alert('Lỗi truy cập microphone: ' + error.message)
            setIsRecording(false)
        }
    }

    const stopRecording = () => {
        return new Promise((resolve) => {
            log('🛑 stopRecording called');

            // Clear timeouts
            if (maxRecordingTimeoutRef.current) {
                clearTimeout(maxRecordingTimeoutRef.current);
                maxRecordingTimeoutRef.current = null;
            }

            if (recorderRef.current) {
                recorderRef.current.stopRecording(() => {
                    // Lấy blob mới nhất từ recorder
                    const blob = recorderRef.current?.getBlob() || null

                    log('🎤 Recording stopped, blob size:', blob?.size || 0);

                    setRecordingBlob(blob)

                    // Reset recorder reference
                    if (recorderRef.current) {
                        recorderRef.current.destroy()
                        recorderRef.current = null
                    }

                    // Only cleanup stream if not in VAD mode (VAD keeps stream alive)
                    if (!enableVAD && streamRef.current) {
                        streamRef.current.getTracks().forEach(track => track.stop())
                        streamRef.current = null
                    }

                    setIsRecording(false)
                    speechStartTimeRef.current = null
                    lastSpeechTimeRef.current = null
                    recordingStartTimeRef.current = null

                    log('🧹 Cleaned up recording resources')

                    // Trả về blob mới nhất qua Promise
                    resolve(blob)
                })
            } else {
                setIsRecording(false)
                resolve(null)
            }
        })
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (vadIntervalRef.current) {
                clearInterval(vadIntervalRef.current);
            }
            if (maxRecordingTimeoutRef.current) {
                clearTimeout(maxRecordingTimeoutRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop())
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        }
    }, [])

    // Return array for backward compatibility, plus additional VAD methods
    const hookReturn = [isRecording, recordingBlob, startRecording, stopRecording];

    // Add VAD methods if enabled
    if (enableVAD) {
        hookReturn.push({
            isListening,
            vadError,
            startListening,
            stopListening,
            config: { vadConfig, recordingConfig }
        });
    }

    return hookReturn;
}