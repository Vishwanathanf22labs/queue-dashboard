const VALIDATION_PATTERNS = {
  MAX_CONCURRENCY: /^\d+$/,
  BRAND_PROCESSING_CONCURRENCY: /^\d+$/,
  TYPESENSE_PROCESS_CONCURRENCY: /^\d+$/,
  IP_COOLDOWN_DURATION_HOURS: /^\d+(\.\d+)?$/,
  SCRAPER_HOLD_SCHEDULE: /^([^\s]+\s+){4}[^\s]+$/,
  SCRAPER_PAUSE_DURATION_MINUTES: /^\d+$/,
  USAGE_PROXY: /^(true|false)$/,

  ONE_HOUR_MS: /^\d+\s*\*\s*60\s*\*\s*1000$/,
  FIFTY_MINUTES_MS: /^\d+\s*\*\s*60\s*\*\s*1000$/,
  THIRTY_MINUTES_MS: /^\d+\s*\*\s*60\s*\*\s*1000$/,
  TWENTY_MINUTES_MS: /^\d+\s*\*\s*60\s*\*\s*1000$/,

  UP_SCROLL_PROBABILITY: /^(0(\.\d+)?|1(\.0+)?)$/,
  MOUSE_MOVEMENT_PROBABILITY: /^(0(\.\d+)?|1(\.0+)?)$/,
  MOUSE_MOVE_STEPS_MIN: /^\d+$/,
  MOUSE_MOVE_STEPS_MAX: /^\d+$/,
  EXTRA_PAUSE_MIN_MS: /^\d+$/,
  EXTRA_PAUSE_MAX_MS: /^\d+$/,
  LONG_PAUSE_PROBABILITY: /^(0(\.\d+)?|1(\.0+)?)$/,
  LONG_PAUSE_MIN_MS: /^\d+$/,
  LONG_PAUSE_MAX_MS: /^\d+$/,

  SCROLL_STEP_MIN_MULTIPLIER: /^\d+(\.\d+)?$/,
  SCROLL_STEP_MAX_MULTIPLIER: /^\d+(\.\d+)?$/,
  UP_SCROLL_TIME_THRESHOLD_MS: /^\d+$/,
  UP_SCROLL_PROBABILITY_THRESHOLD: /^(0(\.\d+)?|1(\.0+)?)$/,
  UP_SCROLL_STEP_MIN_PX: /^\d+$/,
  UP_SCROLL_STEP_MAX_PX: /^\d+$/,
  SCROLL_DELAY_MIN_MS: /^\d+$/,
  SCROLL_DELAY_MAX_MS: /^\d+$/
};

const ERROR_MESSAGES = {
  MAX_CONCURRENCY: 'Must be a positive integer (e.g., "2")',
  BRAND_PROCESSING_CONCURRENCY: 'Must be a positive integer (e.g., "2")',
  TYPESENSE_PROCESS_CONCURRENCY: 'Must be a positive integer (e.g., "2")',
  IP_COOLDOWN_DURATION_HOURS: 'Must be a positive number (e.g., "1.0")',
  SCRAPER_HOLD_SCHEDULE: 'Must be a valid 5-part cron expression (e.g., "0 */5 * * *")',
  SCRAPER_PAUSE_DURATION_MINUTES: 'Must be a positive integer (e.g., "30")',
  USAGE_PROXY: 'Must be "true" or "false"',

  ONE_HOUR_MS: 'Must be multiplication expression (e.g., "60 * 60 * 1000")',
  FIFTY_MINUTES_MS: 'Must be multiplication expression (e.g., "50 * 60 * 1000")',
  THIRTY_MINUTES_MS: 'Must be multiplication expression (e.g., "30 * 60 * 1000")',
  TWENTY_MINUTES_MS: 'Must be multiplication expression (e.g., "20 * 60 * 1000")',

  UP_SCROLL_PROBABILITY: 'Must be a decimal between 0 and 1 (e.g., "0.15")',
  MOUSE_MOVEMENT_PROBABILITY: 'Must be a decimal between 0 and 1 (e.g., "0.45")',
  MOUSE_MOVE_STEPS_MIN: 'Must be a positive integer (e.g., "12")',
  MOUSE_MOVE_STEPS_MAX: 'Must be a positive integer (e.g., "25")',
  EXTRA_PAUSE_MIN_MS: 'Must be a positive integer (e.g., "800")',
  EXTRA_PAUSE_MAX_MS: 'Must be a positive integer (e.g., "2500")',
  LONG_PAUSE_PROBABILITY: 'Must be a decimal between 0 and 1 (e.g., "0.18")',
  LONG_PAUSE_MIN_MS: 'Must be a positive integer (e.g., "6000")',
  LONG_PAUSE_MAX_MS: 'Must be a positive integer (e.g., "15000")',

  SCROLL_STEP_MIN_MULTIPLIER: 'Must be a positive number (e.g., "0.6")',
  SCROLL_STEP_MAX_MULTIPLIER: 'Must be a positive number (e.g., "0.55")',
  UP_SCROLL_TIME_THRESHOLD_MS: 'Must be a positive integer (e.g., "18000")',
  UP_SCROLL_PROBABILITY_THRESHOLD: 'Must be a decimal between 0 and 1 (e.g., "0.6")',
  UP_SCROLL_STEP_MIN_PX: 'Must be a positive integer (e.g., "40")',
  UP_SCROLL_STEP_MAX_PX: 'Must be a positive integer (e.g., "160")',
  SCROLL_DELAY_MIN_MS: 'Must be a positive integer (e.g., "350")',
  SCROLL_DELAY_MAX_MS: 'Must be a positive integer (e.g., "600")'
};

export function validateField(key, value) {
  const pattern = VALIDATION_PATTERNS[key];
  const errorMessage = ERROR_MESSAGES[key];

  if (!pattern) {
    return {
      valid: false,
      error: `Unknown field: ${key}`
    };
  }

  if (!pattern.test(value)) {
    return {
      valid: false,
      error: errorMessage
    };
  }

  return {
    valid: true,
    error: null
  };
}

export function validateForm(formData) {
  const errors = {};
  let hasErrors = false;

  for (const [key, value] of Object.entries(formData)) {
    const result = validateField(key, value);
    if (!result.valid) {
      errors[key] = result.error;
      hasErrors = true;
    }
  }

  return {
    valid: !hasErrors,
    errors
  };
}

export function getFieldType(key) {
  if (key === 'USAGE_PROXY') {
    return 'select';
  }

  if (key.includes('_MS') && key !== 'SCRAPER_PAUSE_DURATION_MINUTES') {
    return 'text';
  }

  if (key === 'SCRAPER_HOLD_SCHEDULE') {
    return 'text';
  }

  if (key.includes('PROBABILITY') || key.includes('MULTIPLIER') || key === 'IP_COOLDOWN_DURATION_HOURS') {
    return 'number';
  }

  return 'number';
}

export function getFieldPlaceholder(key) {
  const placeholders = {
    MAX_CONCURRENCY: '2',
    BRAND_PROCESSING_CONCURRENCY: '2',
    TYPESENSE_PROCESS_CONCURRENCY: '2',
    IP_COOLDOWN_DURATION_HOURS: '1.0',
    SCRAPER_HOLD_SCHEDULE: '0 */5 * * *',
    SCRAPER_PAUSE_DURATION_MINUTES: '30',
    ONE_HOUR_MS: '60 * 60 * 1000',
    FIFTY_MINUTES_MS: '50 * 60 * 1000',
    THIRTY_MINUTES_MS: '30 * 60 * 1000',
    TWENTY_MINUTES_MS: '20 * 60 * 1000',
    UP_SCROLL_PROBABILITY: '0.15',
    MOUSE_MOVEMENT_PROBABILITY: '0.45',
    MOUSE_MOVE_STEPS_MIN: '12',
    MOUSE_MOVE_STEPS_MAX: '25',
    EXTRA_PAUSE_MIN_MS: '800',
    EXTRA_PAUSE_MAX_MS: '2500',
    LONG_PAUSE_PROBABILITY: '0.18',
    LONG_PAUSE_MIN_MS: '6000',
    LONG_PAUSE_MAX_MS: '15000',
    SCROLL_STEP_MIN_MULTIPLIER: '0.6',
    SCROLL_STEP_MAX_MULTIPLIER: '0.55',
    UP_SCROLL_TIME_THRESHOLD_MS: '18000',
    UP_SCROLL_PROBABILITY_THRESHOLD: '0.6',
    UP_SCROLL_STEP_MIN_PX: '40',
    UP_SCROLL_STEP_MAX_PX: '160',
    SCROLL_DELAY_MIN_MS: '350',
    SCROLL_DELAY_MAX_MS: '600'
  };

  return placeholders[key] || '';
}

export function getFieldStep(key) {
  if (key.includes('PROBABILITY') || key.includes('MULTIPLIER') || key === 'IP_COOLDOWN_DURATION_HOURS') {
    return '0.01';
  }
  return '1';
}
