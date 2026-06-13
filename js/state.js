/**
 * @fileoverview MindCare AI — State Management & Local Storage Handlers
 * @module state
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
  chatHistory: [] // Array of { role: "user"|"model"|"system", content: "..." }
};

// Storage keys
const STORAGE_PREFIX = "mindcare_";
const KEY_PROVIDER = `${STORAGE_PREFIX}api_provider`;
const KEY_BASE_URL = `${STORAGE_PREFIX}api_base_url`;
const KEY_MODEL = `${STORAGE_PREFIX}api_model`;
const KEY_OBFUSCATED_API_KEY = `${STORAGE_PREFIX}api_key_secure`;
const KEY_EXAM = `${STORAGE_PREFIX}student_exam`;
const KEY_HOURS = `${STORAGE_PREFIX}student_study_hours`;

/**
 * Simple key obfuscation using Base64 + key salt to avoid cleartext local storage scanners.
 * NOTE: This is for defense-in-depth on student local computers.
 * @param {string} rawKey 
 * @returns {string} Obfuscated key
 */
function obfuscateKey(rawKey) {
  if (!rawKey) return "";
  try {
    const reversed = rawKey.split("").reverse().join("");
    return btoa(reversed + "_mindcare_salt");
  } catch (e) {
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
  } catch (e) {
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

  // Clear storage
  localStorage.removeItem(KEY_PROVIDER);
  localStorage.removeItem(KEY_BASE_URL);
  localStorage.removeItem(KEY_MODEL);
  localStorage.removeItem(KEY_OBFUSCATED_API_KEY);
  localStorage.removeItem(KEY_EXAM);
  localStorage.removeItem(KEY_HOURS);
  
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
 * Updates a specific state key and saves config if needed.
 * @param {string} key 
 * @param {*} value 
 */
export function updateState(key, value) {
  if (key in state) {
    state[key] = value;
  }
}
