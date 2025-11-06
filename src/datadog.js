import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';

// Datadog RUM configuration
export const initDatadog = (userId = null) => {
  datadogRum.init({
    applicationId: '2edb5924-f89a-4c3a-8d63-735c4be8ce2e',
    clientToken: 'pubdcca49ebb759ba56f399f1356b1bc1d9',
    site: 'us5.datadoghq.com',
    service: 'echo-tower-game',
    env: process.env.NODE_ENV || 'development',
    // Specify a version number to identify the deployed version of your application in Datadog
    version: '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    defaultPrivacyLevel: 'mask-user-input',
    plugins: [reactPlugin({ router: false })],
    // Additional configuration for better tracking
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    // Custom global context
    beforeSend: (event) => {
      // Add custom context to all events
      event.context = {
        ...event.context,
        game: {
          name: 'Echo Tower',
          type: 'pronunciation-game'
        }
      };
      return event;
    }
  });

  // Set user context if userId is provided
  if (userId) {
    datadogRum.setUser({
      id: userId,
      name: `User ${userId}`,
      email: null // We don't have email from URL params
    });
    console.log('🐕 Datadog RUM initialized with user:', userId);
  } else {
    console.log('🐕 Datadog RUM initialized without user context');
  }
};

// Function to update user context after initialization
export const setDatadogUser = (userId, additionalInfo = {}) => {
  if (userId) {
    datadogRum.setUser({
      id: userId,
      name: `User ${userId}`,
      ...additionalInfo
    });
    console.log('🐕 Datadog user context updated:', userId);
  }
};

// Custom logging functions for game events
export const logGameEvent = (eventName, properties = {}) => {
  datadogRum.addAction(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
    source: 'game'
  });
};

export const logPronunciationEvent = (word, score, accuracy, method = 'api') => {
  datadogRum.addAction('pronunciation_scored', {
    word,
    score,
    accuracy,
    method,
    timestamp: new Date().toISOString()
  });
};

export const logVADEvent = (eventType, details = {}) => {
  datadogRum.addAction(`vad_${eventType}`, {
    ...details,
    timestamp: new Date().toISOString(),
    source: 'vad'
  });
};

export const logGameStateChange = (fromState, toState, floor = null, score = null) => {
  datadogRum.addAction('game_state_change', {
    from_state: fromState,
    to_state: toState,
    floor,
    score,
    timestamp: new Date().toISOString()
  });
};

export const logError = (error, context = {}) => {
  datadogRum.addError(error, {
    ...context,
    timestamp: new Date().toISOString()
  });
};

// Performance tracking
export const startPerformanceTimer = (name) => {
  return {
    name,
    startTime: performance.now(),
    end: function(additionalContext = {}) {
      const duration = performance.now() - this.startTime;
      datadogRum.addAction(`performance_${name}`, {
        duration_ms: duration,
        ...additionalContext,
        timestamp: new Date().toISOString()
      });
      return duration;
    }
  };
};