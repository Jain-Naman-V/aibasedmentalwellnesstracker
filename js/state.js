/**
 * @fileoverview MindCare AI — State Management & Local Storage Handlers
 * @module state
 *
 * Security Design Notes:
 * - API keys are obfuscated (Base64 + salt reversal) in both localStorage and sessionStorage.
 *   This is intentionally NOT encryption — it is defense-in-depth to prevent casual plaintext
 *   scanning tools from harvesting keys on shared student computers.
 * - Journal history is stored locally and never transmitted to external servers.
 */

// Global state container
const state = {
  apiProvider: "gemini", // "gemini" or "openai"
  apiBaseUrl: "",
  apiKey: "",
  apiModel: "",
  saveKeyPersistent: false,

  // Student Profile
  studentExam: "jee",
  studentStudyHours: 8,

  // Journal Log
  currentMood: "",
  currentJournal: "",

  // Analyzed Results
  analysisResult: null,

  // Chat History
  chatHistory: [], // Array of { role: "user"|"assistant", content: "..." }

  // Journal History for emotional pattern tracking across sessions
  journalHistory: [] // Array of { date, mood, stressScore, triggers, summary }
};

/** Expected types for state keys — used for runtime validation */
const STATE_TYPES = {
  apiProvider: "string",
  apiBaseUrl: "string",
  apiKey: "string",
  apiModel: "string",
  saveKeyPersistent: "boolean",
  studentExam: "string",
  studentStudyHours: "number",
  currentMood: "string",
  currentJournal: "string",
  analysisResult: "object",
  chatHistory: "object",
  journalHistory: "object"
};

// Storage keys
const STORAGE_PREFIX = "mindcare_";
const KEY_PROVIDER = `${STORAGE_PREFIX}api_provider`;
const KEY_BASE_URL = `${STORAGE_PREFIX}api_base_url`;
const KEY_MODEL = `${STORAGE_PREFIX}api_model`;
const KEY_OBFUSCATED_API_KEY = `${STORAGE_PREFIX}api_key_secure`;
const KEY_EXAM = `${STORAGE_PREFIX}student_exam`;
const KEY_HOURS = `${STORAGE_PREFIX}student_study_hours`;
const KEY_JOURNAL_HISTORY = `${STORAGE_PREFIX}journal_history`;

/**
 * Simple key obfuscation using Base64 + key salt to avoid cleartext local storage scanners.
 * This is NOT encryption — it is intentional defense-in-depth for student shared computers.
 * @param {string} rawKey
 * @returns {string} Obfuscated key
 */
function obfuscateKey(rawKey) {
  if (!rawKey) return "";
  try {
    const reversed = rawKey.split("").reverse().join("");
    return btoa(reversed + "_mindcare_salt");
  } catch {
    return rawKey;
  }
}

/**
 * De-obfuscate the saved local storage key.
 * @param {string} obfuscatedKey
 * @returns {string} Plaintext key
 */
function deobfuscateKey(obfuscatedKey) {
  if (!obfuscatedKey) return "";
  try {
    const rawDecoded = atob(obfuscatedKey);
    const cleaned = rawDecoded.replace(/_mindcare_salt$/, "");
    return cleaned.split("").reverse().join("");
  } catch {
    return obfuscatedKey;
  }
}

/**
 * Saves configuration to browser storage.
 */
export function saveConfig() {
  localStorage.setItem(KEY_PROVIDER, state.apiProvider);
  localStorage.setItem(KEY_BASE_URL, state.apiBaseUrl);
  localStorage.setItem(KEY_MODEL, state.apiModel);
  localStorage.setItem(KEY_EXAM, state.studentExam);
  localStorage.setItem(KEY_HOURS, state.studentStudyHours.toString());

  if (state.saveKeyPersistent && state.apiKey) {
    localStorage.setItem(KEY_OBFUSCATED_API_KEY, obfuscateKey(state.apiKey));
    sessionStorage.removeItem(KEY_OBFUSCATED_API_KEY);
  } else {
    localStorage.removeItem(KEY_OBFUSCATED_API_KEY);
    // Keep it in session memory only, obfuscated
    sessionStorage.setItem(KEY_OBFUSCATED_API_KEY, obfuscateKey(state.apiKey));
  }
}

/**
 * Loads configurations from browser storage.
 */
export function loadConfig() {
  state.apiProvider = localStorage.getItem(KEY_PROVIDER) || "gemini";
  state.apiBaseUrl = localStorage.getItem(KEY_BASE_URL) || "";
  state.apiModel = localStorage.getItem(KEY_MODEL) || "";
  state.studentExam = localStorage.getItem(KEY_EXAM) || "jee";
  state.studentStudyHours = parseInt(localStorage.getItem(KEY_HOURS) || "8", 10);

  // Attempt to restore API key
  const savedLocalKey = localStorage.getItem(KEY_OBFUSCATED_API_KEY);
  if (savedLocalKey) {
    state.apiKey = deobfuscateKey(savedLocalKey);
    state.saveKeyPersistent = true;
  } else {
    // Fallback to session storage
    const savedSessionKey = sessionStorage.getItem(KEY_OBFUSCATED_API_KEY);
    state.apiKey = savedSessionKey ? deobfuscateKey(savedSessionKey) : "";
    state.saveKeyPersistent = false;
  }

  // Load journal history for emotional pattern tracking
  loadJournalHistory();
}

/**
 * Loads persisted journal history from localStorage.
 * Safely handles corrupted/missing data.
 */
function loadJournalHistory() {
  try {
    const raw = localStorage.getItem(KEY_JOURNAL_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.journalHistory = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    state.journalHistory = [];
  }
}

/**
 * Persists a journal entry summary to history for emotional pattern detection.
 * Keeps only the last 30 entries to bound storage usage.
 *
 * @param {Object} entry - { date, mood, stressScore, triggers, summary }
 */
export function addJournalEntry(entry) {
  if (!entry || typeof entry !== "object") return;

  state.journalHistory.push(entry);

  // Cap at 30 entries to prevent unbounded storage growth
  const MAX_HISTORY = 30;
  if (state.journalHistory.length > MAX_HISTORY) {
    state.journalHistory = state.journalHistory.slice(-MAX_HISTORY);
  }

  try {
    localStorage.setItem(KEY_JOURNAL_HISTORY, JSON.stringify(state.journalHistory));
  } catch {
    // Storage quota exceeded — silently degrade
  }
}

/**
 * Fully wipes all local and session settings, chats, and states.
 */
export function resetAllData() {
  // Clear state
  state.apiProvider = "gemini";
  state.apiBaseUrl = "";
  state.apiKey = "";
  state.apiModel = "";
  state.saveKeyPersistent = false;
  state.studentExam = "jee";
  state.studentStudyHours = 8;
  state.currentMood = "";
  state.currentJournal = "";
  state.analysisResult = null;
  state.chatHistory = [];
  state.journalHistory = [];

  // Clear storage
  localStorage.removeItem(KEY_PROVIDER);
  localStorage.removeItem(KEY_BASE_URL);
  localStorage.removeItem(KEY_MODEL);
  localStorage.removeItem(KEY_OBFUSCATED_API_KEY);
  localStorage.removeItem(KEY_EXAM);
  localStorage.removeItem(KEY_HOURS);
  localStorage.removeItem(KEY_JOURNAL_HISTORY);

  sessionStorage.clear();
}

/**
 * Retrieves the current state object.
 * @returns {Object}
 */
export function getState() {
  return state;
}

/**
 * Updates a specific state key with runtime type validation.
 * @param {string} key
 * @param {*} value
 */
export function updateState(key, value) {
  if (!(key in state)) return;

  // Runtime type guard — warn on mismatched types (null/undefined bypass for nullable fields)
  const expectedType = STATE_TYPES[key];
  if (value !== null && value !== undefined && expectedType && typeof value !== expectedType) {
    console.warn(`[MindCare] updateState type mismatch: "${key}" expected ${expectedType}, got ${typeof value}`);
  }

  state[key] = value;
}
