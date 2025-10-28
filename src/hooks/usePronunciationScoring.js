import { useRef, useState, useEffect, useCallback } from 'react'

// Base64 utilities
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const Base64 = {
  btoa: (input = "") => {
    let str = input;
    let output = "";

    for (
      let block = 0, charCode, i = 0, map = chars;
      str.charAt(i | 0) || ((map = "="), i % 1);
      output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
    ) {
      charCode = str.charCodeAt((i += 3 / 4));

      if (charCode > 0xff) {
        throw new Error(
          "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
        );
      }

      block = (block << 8) | charCode;
    }

    return output;
  },

  atob: (input = "") => {
    let str = input.replace(/[=]+$/, "");
    let output = "";

    if (str.length % 4 === 1) {
      throw new Error(
        "'atob' failed: The string to be decoded is not correctly encoded."
      );
    }
    for (
      let bc = 0, bs = 0, buffer, i = 0;
      (buffer = str.charAt(i++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      buffer = chars.indexOf(buffer);
    }

    return output;
  },
};

function _base64ToArrayBuffer(base64) {
  let binary_string = Base64.atob(base64);
  let len = binary_string.length;
  let bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

const decrypt = (inputString) => {
  const xorKey = "1StepUp1VietNam@";
  let decode = _base64ToArrayBuffer(inputString);
  let decodeString = new TextDecoder("utf-8").decode(new Uint8Array(decode));

  let bytes = [];
  for (let i = 0; i < decodeString.length; i++) {
    let index = i >= xorKey.length ? xorKey.length - 1 : i;
    bytes[i] = String.fromCharCode(
      decodeString.charCodeAt(i) ^ xorKey.charCodeAt(index)
    );
  }
  try {
    const jsonString = bytes.join("");
    if (jsonString.trim() === '') {
      throw new Error('Empty JSON string');
    }
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing decrypted data:', error);
    return null;
  }
};

// API function to check pronunciation
const checkPronunciation = async (audioBlob, textRefs, requestId = 'unknown', apiConfig = {}) => {
  console.log('checkPronunciation called with:', {
    requestId,
    audioBlobSize: audioBlob.size,
    textRefs: textRefs,
    timestamp: new Date().toISOString()
  });

  try {
    const formData = new FormData();
    formData.append('audio-file', audioBlob, 'recording.wav');
    formData.append('text-refs', textRefs);

    console.log('Sending API request:', { requestId, textRefs, timestamp: new Date().toISOString() });

    // Use provided API config or default
    const apiUrl = apiConfig.url || 'https://tofutest.stepup.edu.vn/speech/api/v1/check/tofu-open/speech?app_user_id=7445&app_device_id=EC2C5948-3B80-40F6-BF44-1487E7C7435D3&app_v=2.5.7&platform=ios-18.7&app_user_tier=free';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        ...apiConfig.headers
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Raw API response:', { requestId, result, timestamp: new Date().toISOString() });

    if (result.data) {
      const decryptedData = decrypt(result.data);
      console.log('🎯 Decrypted API data SUCCESS:', {
        requestId,
        decryptedData,
        hasValidData: !!decryptedData,
        totalScore: decryptedData?.total_score,
        textRefs: decryptedData?.text_refs,
        hasLetters: decryptedData?.result?.[0]?.letters?.length > 0,
        timestamp: new Date().toISOString()
      });

      // Verify the response matches the request (case insensitive)
      if (decryptedData && decryptedData.text_refs?.toLowerCase() !== textRefs.toLowerCase()) {
        console.error('🚨 API RESPONSE MISMATCH DETECTED:', {
          requestId,
          requested: textRefs,
          received: decryptedData.text_refs,
          requestedLower: textRefs.toLowerCase(),
          receivedLower: decryptedData.text_refs?.toLowerCase(),
          timestamp: new Date().toISOString()
        });

        return null;
      }

      console.log('✅ API data validation passed, returning REAL data:', {
        requestId,
        textRefs: decryptedData.text_refs,
        totalScore: decryptedData.total_score,
        lettersCount: decryptedData.result?.[0]?.letters?.length
      });
      return decryptedData;
    } else {
      throw new Error('No data in response');
    }
  } catch (error) {
    console.error('Error checking pronunciation:', error);
    return null;
  }
};

export const usePronunciationScoring = (config = {}) => {
  // Configuration with defaults
  const {
    mode = 'manual', // 'manual' or 'vad'
    autoAnalyze = false, // Auto-analyze after VAD recording completes
    textToAnalyze = '', // Text to analyze (required for auto-analyze)
    vadConfig = {
      silenceThreshold: -30,
      speechThreshold: -18,
      minSpeechDuration: 300,
      maxSilenceDuration: 800,
      maxRecordingTime: 7000
    },
    recordingConfig = {
      mimeType: 'audio/wav',
      numberOfAudioChannels: 1,
      desiredSampRate: 16000,
      bufferSize: 4096
    },
    apiConfig = {},
    enableLogging = true,
    onAnalysisComplete = null // Callback when auto-analysis completes
  } = config;

  // Recording refs and state
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const maxRecordingTimeoutRef = useRef(null);

  // VAD tracking refs
  const speechStartTimeRef = useRef(null);
  const lastSpeechTimeRef = useRef(null);
  const noiseFloorRef = useRef(-30);
  const audioLevelsRef = useRef([]);
  const recordingStartTimeRef = useRef(null);

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [vadError, setVadError] = useState(null);
  const [forceStop, setForceStop] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const log = useCallback((...args) => {
    if (enableLogging) {
      console.log(...args);
    }
  }, [enableLogging]);

  // Debug state changes
  useEffect(() => {
    log('🎤 usePronunciationScoring state changed:', {
      isRecording,
      isListening,
      forceStop,
      isProcessing,
      mode
    });
  }, [isRecording, isListening, forceStop, isProcessing, mode, log]);

  // Pre-warm audio context
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!audioContextRef.current) {
        log('🔥 Pre-warming audio context...');
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
    };

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [log]);

  // Initialize audio resources
  const initializeAudio = useCallback(async () => {
    if (streamRef.current && audioContextRef.current && analyserRef.current) {
      log('🔄 Audio already initialized, reusing...');
      return true;
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

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();

      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      source.connect(analyserRef.current);

      log('✅ Audio initialized successfully');
      return true;
    } catch (error) {
      log('❌ Error initializing audio:', error);
      setVadError(error.message);
      setError(error.message);
      return false;
    }
  }, [log]);

  // Get audio level in dB
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

    if (Math.random() < 0.05) {
      log('🔊 Audio level:', dB.toFixed(1), 'dB, average:', average.toFixed(1));
    }

    return dB;
  }, [log]);

  // Start recording
  const startRecording = useCallback(async () => {
    log('🎤 startRecording called', {
      isCurrentlyRecording: isRecording,
      hasStream: !!streamRef.current,
      hasRecorder: !!recorderRef.current,
      mode
    });

    if (isRecording) {
      log('⚠️ Already recording, ignoring start request');
      return;
    }

    if (typeof window === 'undefined' || !navigator?.mediaDevices) {
      const errorMsg = 'Browser does not support recording';
      setError(errorMsg);
      alert(errorMsg);
      return;
    }

    try {
      setError(null);
      log('📦 Loading RecordRTC...');
      const { default: RecordRTC } = await import('recordrtc');

      // Initialize audio if not already done
      if (!streamRef.current) {
        const audioReady = await initializeAudio();
        if (!audioReady) {
          throw new Error('Failed to initialize audio');
        }
      }

      recorderRef.current = new RecordRTC(streamRef.current, {
        type: 'audio',
        mimeType: recordingConfig.mimeType,
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: recordingConfig.numberOfAudioChannels,
        desiredSampRate: recordingConfig.desiredSampRate,
        bufferSize: recordingConfig.bufferSize,
      });

      log('▶️ Starting recording...');
      setRecordingBlob(null);
      recorderRef.current.startRecording();
      setIsRecording(true);
      setForceStop(false);
      speechStartTimeRef.current = Date.now();
      recordingStartTimeRef.current = Date.now();

      // Set timeout for max recording time
      if (mode === 'vad') {
        maxRecordingTimeoutRef.current = setTimeout(() => {
          log('⏰ Max recording timeout reached, forcing stop');
          setForceStop(true);
        }, vadConfig.maxRecordingTime);
      }

      log('✅ Recording started successfully');
    } catch (error) {
      log('❌ Error starting recording:', error);
      setError(error.message);
      alert('Error starting recording: ' + error.message);
      setIsRecording(false);
    }
  }, [isRecording, mode, recordingConfig, vadConfig.maxRecordingTime, initializeAudio, log]);

  // Internal pronunciation processing (without dependencies to avoid loops)
  const processPronunciationInternal = useCallback(async (textRefs, audioBlob) => {
    if (!audioBlob) {
      throw new Error('No audio recording available');
    }

    if (!textRefs || textRefs.trim() === '') {
      throw new Error('Text reference is required');
    }

    setIsProcessing(true);
    setError(null);

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    log('🎯 Processing pronunciation for:', { textRefs, requestId });

    const result = await checkPronunciation(audioBlob, textRefs, requestId, apiConfig);

    if (result) {
      setLastResult(result);
      log('✅ Pronunciation processing completed successfully');
      setIsProcessing(false);
      return result;
    } else {
      const errorMsg = 'Failed to process pronunciation';
      setError(errorMsg);
      log('❌ Pronunciation processing failed');
      setIsProcessing(false);
      throw new Error(errorMsg);
    }
  }, [apiConfig, log]);

  // Stop recording
  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      log('🛑 stopRecording called');

      if (maxRecordingTimeoutRef.current) {
        clearTimeout(maxRecordingTimeoutRef.current);
        maxRecordingTimeoutRef.current = null;
      }

      if (recorderRef.current && isRecording) {
        recorderRef.current.stopRecording(async () => {
          const blob = recorderRef.current?.getBlob() || null;

          log('🎤 Recording stopped, blob size:', blob?.size || 0);

          setRecordingBlob(blob);

          if (recorderRef.current) {
            recorderRef.current.destroy();
            recorderRef.current = null;
          }

          // Only cleanup stream in manual mode
          if (mode === 'manual' && streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }

          setIsRecording(false);
          speechStartTimeRef.current = null;
          recordingStartTimeRef.current = null;

          log('🧹 Cleaned up recording resources');

          // Auto-analyze if enabled and in VAD mode
          if (mode === 'vad' && autoAnalyze && textToAnalyze && blob) {
            log('🚀 Auto-analyzing pronunciation after VAD recording...');
            try {
              const result = await processPronunciationInternal(textToAnalyze, blob);
              if (result && onAnalysisComplete) {
                onAnalysisComplete(result);
              }
            } catch (error) {
              log('❌ Auto-analysis failed:', error);
              setError(`Auto-analysis failed: ${error.message}`);
            }
          }

          resolve(blob);
        });
      } else {
        setIsRecording(false);
        speechStartTimeRef.current = null;
        recordingStartTimeRef.current = null;
        resolve(null);
      }
    });
  }, [isRecording, mode, autoAnalyze, textToAnalyze, onAnalysisComplete, processPronunciationInternal, log]);

  // VAD processing loop
  const processVAD = useCallback(() => {
    const audioLevel = getAudioLevel();
    const now = Date.now();

    audioLevelsRef.current.push(audioLevel);
    if (audioLevelsRef.current.length > 50) {
      audioLevelsRef.current.shift();
    }

    if (audioLevelsRef.current.length >= 20) {
      const sortedLevels = [...audioLevelsRef.current].sort((a, b) => a - b);
      const noiseFloorSamples = sortedLevels.slice(0, Math.floor(sortedLevels.length * 0.3));
      noiseFloorRef.current = noiseFloorSamples.reduce((sum, level) => sum + level, 0) / noiseFloorSamples.length;
    }

    const adaptiveSilenceThreshold = noiseFloorRef.current + 2;
    const adaptiveSpeechThreshold = noiseFloorRef.current + 8;

    if (audioLevel > adaptiveSpeechThreshold) {
      if (Math.random() < 0.3) {
        log('🗣️ Speech detected! Level:', audioLevel.toFixed(1), 'dB');
      }
      lastSpeechTimeRef.current = now;
    } else if (audioLevel < adaptiveSilenceThreshold) {
      if (isRecording && lastSpeechTimeRef.current) {
        const silenceDuration = now - lastSpeechTimeRef.current;
        const speechDuration = lastSpeechTimeRef.current - (speechStartTimeRef.current || now);

        if (Math.random() < 0.5) {
          log('🤐 Silence check:', {
            silenceDuration,
            speechDuration,
            maxSilence: vadConfig.maxSilenceDuration,
            minSpeech: vadConfig.minSpeechDuration
          });
        }

        if (silenceDuration > vadConfig.maxSilenceDuration && speechDuration > vadConfig.minSpeechDuration) {
          log('🛑 Stopping recording due to silence');
          stopRecording();
        }
      }
    }
  }, [getAudioLevel, isRecording, isListening, vadConfig.maxSilenceDuration, vadConfig.minSpeechDuration, stopRecording, log]);

  // Handle force stop from timeout
  useEffect(() => {
    if (forceStop && isRecording) {
      log('🛑 Force stopping recording due to timeout');
      stopRecording().then(() => {
        log('✅ Force stop completed');
        setForceStop(false);
      });
    }
  }, [forceStop, isRecording, stopRecording, log]);

  // Start/stop VAD processing
  useEffect(() => {
    if (isListening && mode === 'vad') {
      log('🔄 Starting VAD processing loop...');
      vadIntervalRef.current = setInterval(processVAD, 50);
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
  }, [isListening, mode, processVAD, log]);

  // Start VAD listening
  const startListening = useCallback(async () => {
    if (mode !== 'vad') {
      log('⚠️ startListening called but mode is not VAD');
      return;
    }

    try {
      setVadError(null);
      setError(null);
      log('👂 Starting VAD listening...');

      const audioReady = await initializeAudio();
      if (!audioReady) {
        throw new Error('Failed to initialize audio');
      }

      setIsListening(true);

      setTimeout(() => {
        if (!isRecording) {
          log('🎤 Auto-starting recording for VAD mode');
          startRecording();
        }
      }, 100);

      log('✅ VAD listening started successfully');

    } catch (error) {
      log('❌ Error starting VAD:', error);
      setVadError(error.message);
      setError(error.message);
      alert('Error starting VAD: ' + error.message);
    }
  }, [mode, initializeAudio, isRecording, startRecording, log]);

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
      log('❌ Error stopping VAD:', error);
      setError(error.message);
    }
  }, [isRecording, stopRecording, log]);

  // Process pronunciation scoring (public method)
  const processPronunciation = useCallback(async (textRefs, audioBlob = null) => {
    const blobToUse = audioBlob || recordingBlob;

    if (!blobToUse) {
      const errorMsg = 'No audio recording available';
      setError(errorMsg);
      log('❌ No audio blob available for processing');
      return null;
    }

    try {
      return await processPronunciationInternal(textRefs, blobToUse);
    } catch (error) {
      const errorMsg = `Error processing pronunciation: ${error.message}`;
      setError(errorMsg);
      log('❌ Error in processPronunciation:', error);
      return null;
    }
  }, [recordingBlob, processPronunciationInternal, log]);

  // Clear recording blob
  const clearBlob = useCallback(() => {
    log('🎤 Clearing recordingBlob');
    setRecordingBlob(null);
    setLastResult(null);
    setError(null);
  }, [log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      log('🧹 usePronunciationScoring cleanup on unmount');

      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
      }
      if (maxRecordingTimeoutRef.current) {
        clearTimeout(maxRecordingTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      if (recorderRef.current) {
        recorderRef.current.destroy();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [log]);

  return {
    // State
    isRecording,
    recordingBlob,
    isListening,
    isProcessing,
    lastResult,
    error,
    vadError,

    // Manual recording methods
    startRecording,
    stopRecording,

    // VAD methods
    startListening,
    stopListening,

    // Processing methods
    processPronunciation,
    clearBlob,

    // Utility methods
    initializeAudio,

    // Configuration
    mode,
    autoAnalyze,
    textToAnalyze,
    config: {
      vadConfig,
      recordingConfig,
      apiConfig
    }
  };
};

export default usePronunciationScoring;