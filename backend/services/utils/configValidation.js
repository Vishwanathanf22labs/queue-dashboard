/**
 * Configuration validation for Redis config hash
 * Validates exact string formats for each config key
 */

// Whitelist of allowed config keys
const ALLOWED_CONFIG_KEYS = [
  // Processing and holding timing
  'MAX_CONCURRENCY',
  'BRAND_PROCESSING_CONCURRENCY', 
  'TYPESENSE_PROCESS_CONCURRENCY',
  'IP_COOLDOWN_DURATION_HOURS',
  'SCRAPER_HOLD_SCHEDULE',
  'SCRAPER_PAUSE_DURATION_MINUTES',
  'USAGE_PROXY',
  
  // Scroll duration
  'ONE_HOUR_MS',
  'FIFTY_MINUTES_MS',
  'THIRTY_MINUTES_MS',
  'TWENTY_MINUTES_MS',
  
  // Scroller details
  'UP_SCROLL_PROBABILITY',
  'MOUSE_MOVEMENT_PROBABILITY',
  'MOUSE_MOVE_STEPS_MIN',
  'MOUSE_MOVE_STEPS_MAX',
  'EXTRA_PAUSE_MIN_MS',
  'EXTRA_PAUSE_MAX_MS',
  'LONG_PAUSE_PROBABILITY',
  'LONG_PAUSE_MIN_MS',
  'LONG_PAUSE_MAX_MS',
  
  // Scroll behavior configs
  'SCROLL_STEP_MIN_MULTIPLIER',
  'SCROLL_STEP_MAX_MULTIPLIER',
  'UP_SCROLL_TIME_THRESHOLD_MS',
  'UP_SCROLL_PROBABILITY_THRESHOLD',
  'UP_SCROLL_STEP_MIN_PX',
  'UP_SCROLL_STEP_MAX_PX',
  'SCROLL_DELAY_MIN_MS',
  'SCROLL_DELAY_MAX_MS'
];

// Validation schemas for each key
const VALIDATION_SCHEMAS = {
  // Processing and holding timing
  MAX_CONCURRENCY: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "2")'
  },
  BRAND_PROCESSING_CONCURRENCY: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "2")'
  },
  TYPESENSE_PROCESS_CONCURRENCY: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "2")'
  },
  IP_COOLDOWN_DURATION_HOURS: {
    pattern: /^\d+(\.\d+)?$/,
    message: 'Must be a positive number (e.g., "1.0")'
  },
  SCRAPER_HOLD_SCHEDULE: {
    pattern: /^([^\s]+\s+){4}[^\s]+$/,
    message: 'Must be a valid 5-part cron expression (e.g., "0 */5 * * *")'
  },
  SCRAPER_PAUSE_DURATION_MINUTES: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "30")'
  },
  USAGE_PROXY: {
    pattern: /^(true|false)$/,
    message: 'Must be "true" or "false"'
  },
  
  // Scroll duration (multiplication expressions)
  ONE_HOUR_MS: {
    pattern: /^\d+\s*\*\s*60\s*\*\s*1000$/,
    message: 'Must be multiplication expression (e.g., "60 * 60 * 1000")'
  },
  FIFTY_MINUTES_MS: {
    pattern: /^\d+\s*\*\s*60\s*\*\s*1000$/,
    message: 'Must be multiplication expression (e.g., "50 * 60 * 1000")'
  },
  THIRTY_MINUTES_MS: {
    pattern: /^\d+\s*\*\s*60\s*\*\s*1000$/,
    message: 'Must be multiplication expression (e.g., "30 * 60 * 1000")'
  },
  TWENTY_MINUTES_MS: {
    pattern: /^\d+\s*\*\s*60\s*\*\s*1000$/,
    message: 'Must be multiplication expression (e.g., "20 * 60 * 1000")'
  },
  
  // Scroller details
  UP_SCROLL_PROBABILITY: {
    pattern: /^(0(\.\d+)?|1(\.0+)?)$/,
    message: 'Must be a decimal between 0 and 1 (e.g., "0.15")'
  },
  MOUSE_MOVEMENT_PROBABILITY: {
    pattern: /^(0(\.\d+)?|1(\.0+)?)$/,
    message: 'Must be a decimal between 0 and 1 (e.g., "0.45")'
  },
  MOUSE_MOVE_STEPS_MIN: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "12")'
  },
  MOUSE_MOVE_STEPS_MAX: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "25")'
  },
  EXTRA_PAUSE_MIN_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "800")'
  },
  EXTRA_PAUSE_MAX_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "2500")'
  },
  LONG_PAUSE_PROBABILITY: {
    pattern: /^(0(\.\d+)?|1(\.0+)?)$/,
    message: 'Must be a decimal between 0 and 1 (e.g., "0.18")'
  },
  LONG_PAUSE_MIN_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "6000")'
  },
  LONG_PAUSE_MAX_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "15000")'
  },
  
  // Scroll behavior configs
  SCROLL_STEP_MIN_MULTIPLIER: {
    pattern: /^\d+(\.\d+)?$/,
    message: 'Must be a positive number (e.g., "0.6")'
  },
  SCROLL_STEP_MAX_MULTIPLIER: {
    pattern: /^\d+(\.\d+)?$/,
    message: 'Must be a positive number (e.g., "0.55")'
  },
  UP_SCROLL_TIME_THRESHOLD_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "18000")'
  },
  UP_SCROLL_PROBABILITY_THRESHOLD: {
    pattern: /^(0(\.\d+)?|1(\.0+)?)$/,
    message: 'Must be a decimal between 0 and 1 (e.g., "0.6")'
  },
  UP_SCROLL_STEP_MIN_PX: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "40")'
  },
  UP_SCROLL_STEP_MAX_PX: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "160")'
  },
  SCROLL_DELAY_MIN_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "350")'
  },
  SCROLL_DELAY_MAX_MS: {
    pattern: /^\d+$/,
    message: 'Must be a positive integer (e.g., "600")'
  }
};

/**
 * Validate a single config key-value pair
 * @param {string} key - Config key
 * @param {string} value - Config value
 * @returns {Object} Validation result
 */
function validateConfigEntry(key, value) {
  // Check if key is allowed
  if (!ALLOWED_CONFIG_KEYS.includes(key)) {
    return {
      valid: false,
      error: `Key "${key}" is not allowed`
    };
  }

  // Check if value is a string
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `Value for "${key}" must be a string`
    };
  }

  // Get validation schema
  const schema = VALIDATION_SCHEMAS[key];
  if (!schema) {
    return {
      valid: false,
      error: `No validation schema for key "${key}"`
    };
  }

  // Validate against pattern
  if (!schema.pattern.test(value)) {
    return {
      valid: false,
      error: `Invalid format for "${key}": ${schema.message}`
    };
  }

  return {
    valid: true,
    error: null
  };
}

/**
 * Validate multiple config entries
 * @param {Object} updates - Object with key-value pairs to validate
 * @returns {Object} Validation result with errors array
 */
function validateConfigUpdates(updates) {
  const errors = [];
  
  for (const [key, value] of Object.entries(updates)) {
    const result = validateConfigEntry(key, value);
    if (!result.valid) {
      errors.push(result.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get all allowed config keys
 * @returns {Array} Array of allowed keys
 */
function getAllowedConfigKeys() {
  return [...ALLOWED_CONFIG_KEYS];
}

/**
 * Get validation schema for a key
 * @param {string} key - Config key
 * @returns {Object|null} Validation schema or null
 */
function getValidationSchema(key) {
  return VALIDATION_SCHEMAS[key] || null;
}

module.exports = {
  validateConfigEntry,
  validateConfigUpdates,
  getAllowedConfigKeys,
  getValidationSchema,
  ALLOWED_CONFIG_KEYS,
  VALIDATION_SCHEMAS
};
