/**
 * @fileoverview MindCare AI — Main Application Entry & Controller
 * @module main
 */

import { buildAnalysisPrompt, buildCompanionSystemPrompt, getExamName } from "./config.js";
import { getState, loadConfig, saveConfig, updateState, resetAllData, addJournalEntry } from "./state.js";
import { fetchProviderModels, queryAIAnalysis, queryAIChat } from "./api.js";
import { validateJournal, validateUrl, sanitizeJournalInput } from "./helpers.js";
import {
  showScreen, updateStepIndicator, validateWizardStep, writeConsoleLog,
  startBreathingExercise, stopBreathingExercise, advanceBreathingPhase,
  renderDashboardResults, renderJournalHistory,
  appendChatMessage, appendChatTypingIndicator,
  clearChildren, createDefaultOption
} from "./dom.js";

let DOM = {};
let currentWizardStep = 1;
let breathingPlayActive = false;

/** Initializes DOM element selectors. */
function initDomSelectors() {
  DOM = {
    welcomeScreen: document.getElementById("screen-welcome"),
    configScreen: document.getElementById("screen-config"),
    journalScreen: document.getElementById("screen-journal"),
    loaderScreen: document.getElementById("screen-loader"),
    dashboardScreen: document.getElementById("screen-dashboard"),
    btnGoConfig: document.getElementById("btn-go-config"),
    btnGoJournal: document.getElementById("btn-go-journal"),
    logoLink: document.getElementById("logo-link"),
    navLinkWelcome: document.getElementById("nav-welcome"),
    navLinkConfig: document.getElementById("nav-config"),
    navLinkJournal: document.getElementById("nav-journal"),
    configForm: document.getElementById("config-form"),
    apiProviderSelect: document.getElementById("api-provider"),
    apiBaseUrlGroup: document.getElementById("api-base-url-group"),
    apiBaseUrlInput: document.getElementById("api-base-url"),
    apiKeyInput: document.getElementById("api-key"),
    apiModelSelect: document.getElementById("api-model"),
    btnFetchModels: document.getElementById("btn-fetch-models"),
    modelFetchStatus: document.getElementById("model-fetch-status"),
    studentExamSelect: document.getElementById("student-exam"),
    studentHoursInput: document.getElementById("student-study-hours"),
    saveKeyCheckbox: document.getElementById("save-key-persistent"),
    btnResetConfig: document.getElementById("btn-reset-config"),
    btnWizardNext: document.querySelectorAll(".btn-wizard-next"),
    btnWizardPrev: document.querySelectorAll(".btn-wizard-prev"),
    journalForm: document.getElementById("journal-form"),
    journalTextarea: document.getElementById("journal-entry"),
    charCounter: document.getElementById("char-counter"),
    journalErrorMsg: document.getElementById("error-journal-entry"),
    journalHistoryContainer: document.getElementById("journal-history-container"),
    loaderConsoleBody: document.getElementById("console-logs-body"),
    loaderBreathingText: document.getElementById("loader-breathing-label"),
    loaderBubbleOuter: document.querySelector("#screen-loader .breathing-bubble-outer"),
    dashSubtitleMeta: document.getElementById("dash-subtitle-meta"),
    dashStressScoreText: document.getElementById("dash-stress-score"),
    dashStressGaugeMeter: document.getElementById("dash-stress-gauge-meter"),
    dashStressGaugeFill: document.getElementById("dash-stress-gauge-fill"),
    dashStressHeadline: document.getElementById("dash-stress-headline"),
    dashTriggersList: document.getElementById("dash-triggers-list"),
    dashSummaryText: document.getElementById("dash-summary-text"),
    dashCopingList: document.getElementById("dash-coping-checklist"),
    dashEncouragementQuote: document.getElementById("dash-encouragement-quote"),
    dashCrisisBanner: document.getElementById("dash-crisis-banner"),
    dashBreathingSphere: document.getElementById("dash-breathing-sphere"),
    dashBreathingTimer: document.getElementById("dash-breathing-timer"),
    dashBreathingInstruction: document.getElementById("dash-breathing-instruction"),
    btnToggleBreathing: document.getElementById("btn-toggle-breathing"),
    dashChatViewport: document.getElementById("dash-chat-messages"),
    dashChatForm: document.getElementById("dash-chat-form"),
    dashChatInput: document.getElementById("dash-chat-input"),
    btnCopyAnalysis: document.getElementById("btn-copy-analysis"),
    btnDownloadAnalysis: document.getElementById("btn-download-analysis"),
    btnDashboardRestart: document.getElementById("btn-dashboard-restart"),
    btnGlobalReset: document.getElementById("btn-global-reset")
  };
}

// --- Focused Event Handler Functions ---

/** Navigates to config wizard screen. */
function navigateToConfig() {
  currentWizardStep = 1;
  updateStepIndicator(1);
  showScreen(DOM.configScreen);
}

/** Navigates to journal screen with API key guard. */
function navigateToJournal() {
  const state = getState();
  if (!state.apiKey) {
    alert("Please configure your API credentials first!");
    navigateToConfig();
    return;
  }
  showScreen(DOM.journalScreen);
  // Render journal history for emotional pattern tracking
  if (DOM.journalHistoryContainer) {
    renderJournalHistory(DOM.journalHistoryContainer, state.journalHistory);
  }
}

/** Handles provider dropdown change — toggles base URL visibility. */
function handleProviderChange() {
  const provider = DOM.apiProviderSelect.value;
  const showBaseUrl = provider === "openai";

  if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = showBaseUrl ? "flex" : "none";
  if (DOM.apiBaseUrlInput) {
    DOM.apiBaseUrlInput.required = showBaseUrl;
    if (showBaseUrl && !DOM.apiBaseUrlInput.value) {
      DOM.apiBaseUrlInput.value = "https://api.openai.com/v1";
    } else if (!showBaseUrl) {
      DOM.apiBaseUrlInput.value = "";
    }
  }

  // Reset model selector using safe DOM API
  if (DOM.apiModelSelect) {
    clearChildren(DOM.apiModelSelect);
    DOM.apiModelSelect.appendChild(createDefaultOption("-- Click Fetch Models --", ""));
  }
}

/** Populates model select with fallback options. */
function populateFallbackModels(provider) {
  if (!DOM.apiModelSelect) return;
  clearChildren(DOM.apiModelSelect);
  const defaults = provider === "gemini"
    ? ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"]
    : ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
  defaults.forEach(d => {
    DOM.apiModelSelect.appendChild(createDefaultOption(`${d} (Fallback)`, d));
  });
}

/** Fetches available models from provider API. */
async function handleFetchModels() {
  const provider = DOM.apiProviderSelect ? DOM.apiProviderSelect.value : "";
  const url = DOM.apiBaseUrlInput ? DOM.apiBaseUrlInput.value.trim() : "";
  const key = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() : "";

  if (DOM.modelFetchStatus) {
    DOM.modelFetchStatus.textContent = "Loading models...";
    DOM.modelFetchStatus.style.color = "var(--color-text-secondary)";
  }
  DOM.btnFetchModels.disabled = true;

  try {
    let fetchUrl = provider === "gemini" ? "https://generativelanguage.googleapis.com" : url;

    if (provider === "openai" && !validateUrl(fetchUrl)) {
      throw new Error("Please enter a valid base URL starting with http:// or https://");
    }
    if (!key && !fetchUrl.includes("localhost") && !fetchUrl.includes("127.0.0.1")) {
      throw new Error("API key is required to retrieve models.");
    }

    const models = await fetchProviderModels(provider, fetchUrl, key);
    if (!models.length) throw new Error("No available models returned from endpoint.");

    if (DOM.apiModelSelect) {
      clearChildren(DOM.apiModelSelect);
      models.forEach(modelId => {
        DOM.apiModelSelect.appendChild(createDefaultOption(modelId, modelId));
      });
    }

    updateState("apiKey", key);
    updateState("apiProvider", provider);
    updateState("apiBaseUrl", fetchUrl);
    if (DOM.apiModelSelect) updateState("apiModel", DOM.apiModelSelect.value);

    if (DOM.modelFetchStatus) {
      DOM.modelFetchStatus.textContent = `Success! Loaded ${models.length} models.`;
      DOM.modelFetchStatus.style.color = "var(--color-success)";
    }
  } catch (err) {
    console.error(err);
    if (DOM.modelFetchStatus) {
      DOM.modelFetchStatus.textContent = `Error: ${err.message}`;
      DOM.modelFetchStatus.style.color = "var(--color-danger)";
    }
    populateFallbackModels(provider);
  } finally {
    DOM.btnFetchModels.disabled = false;
  }
}

/** Handles config form submission. */
function handleConfigSubmit(e) {
  e.preventDefault();
  if (!validateWizardStep(3, DOM)) return;

  if (DOM.apiProviderSelect) updateState("apiProvider", DOM.apiProviderSelect.value);
  if (DOM.apiBaseUrlInput) updateState("apiBaseUrl", DOM.apiBaseUrlInput.value.trim());
  if (DOM.apiKeyInput) updateState("apiKey", DOM.apiKeyInput.value.trim());
  if (DOM.apiModelSelect) updateState("apiModel", DOM.apiModelSelect.value);
  if (DOM.saveKeyCheckbox) updateState("saveKeyPersistent", DOM.saveKeyCheckbox.checked);
  if (DOM.studentExamSelect) updateState("studentExam", DOM.studentExamSelect.value);
  if (DOM.studentHoursInput) updateState("studentStudyHours", parseInt(DOM.studentHoursInput.value, 10));

  saveConfig();
  alert("Configuration saved successfully!");
  showScreen(DOM.journalScreen);
}

/** Updates character counter on journal input. */
function handleJournalInput() {
  const len = DOM.journalTextarea.value.length;
  if (DOM.charCounter) {
    DOM.charCounter.textContent = `${len} characters`;
    DOM.charCounter.className = len >= 50 ? "textarea-char-counter" : "textarea-char-counter error";
    if (len >= 50 && DOM.journalForm) {
      const formGroup = DOM.journalForm.querySelector(".form-group");
      if (formGroup) formGroup.classList.remove("has-error");
    }
  }
}

/** Handles journal form submission and triggers AI analysis. */
async function handleJournalSubmit(e) {
  e.preventDefault();
  const state = getState();
  if (!DOM.journalTextarea) return;

  const journalText = DOM.journalTextarea.value;
  const moodEl = document.querySelector('input[name="mood"]:checked');

  if (!moodEl) { alert("Please select your current mood!"); return; }
  if (!validateJournal(journalText)) {
    const formGroup = DOM.journalForm.querySelector(".form-group");
    if (formGroup) formGroup.classList.add("has-error");
    if (DOM.journalErrorMsg) DOM.journalErrorMsg.textContent = "Please write at least 50 characters to allow emotional analysis.";
    DOM.journalTextarea.focus();
    return;
  }

  const moodVal = moodEl.value;
  const sanitizedJournal = sanitizeJournalInput(journalText);
  updateState("currentMood", moodVal);
  updateState("currentJournal", sanitizedJournal);

  // Transition to loader screen
  showScreen(DOM.loaderScreen);
  clearChildren(DOM.loaderConsoleBody);

  // Start loader breathing animation
  let loaderSeconds = 4;
  let loaderPhase = "inhale";
  if (DOM.loaderBreathingText) DOM.loaderBreathingText.textContent = `Inhale (4s)`;
  if (DOM.loaderBubbleOuter) DOM.loaderBubbleOuter.style.animationPlayState = "running";

  const loaderBreathingInterval = setInterval(() => {
    loaderSeconds--;
    if (loaderSeconds <= 0) {
      const next = advanceBreathingPhase(loaderPhase);
      loaderPhase = next.phase;
      loaderSeconds = next.seconds;
    }
    if (DOM.loaderBreathingText) {
      DOM.loaderBreathingText.textContent = `${loaderPhase.charAt(0).toUpperCase() + loaderPhase.slice(1)} (${loaderSeconds}s)`;
    }
  }, 1000);

  // Console progress animation
  if (DOM.loaderConsoleBody) {
    await writeConsoleLog(DOM.loaderConsoleBody, "Initializing secure analysis pipeline...", 100, "system");
    await writeConsoleLog(DOM.loaderConsoleBody, `Target Model: ${state.apiModel}`, 200);
    await writeConsoleLog(DOM.loaderConsoleBody, `Mood Logged: ${moodVal}`, 250);
    await writeConsoleLog(DOM.loaderConsoleBody, "Sanitizing input vectors and escaping scripts...", 200, "system");
    await writeConsoleLog(DOM.loaderConsoleBody, "Compiling stress triggers context prompts...", 250);
  }

  const examName = getExamName(state.studentExam);
  const analysisPrompt = buildAnalysisPrompt(sanitizedJournal, moodVal, examName, state.studentStudyHours);

  try {
    if (DOM.loaderConsoleBody) await writeConsoleLog(DOM.loaderConsoleBody, "Sending secure payload to GenAI endpoint...", 150, "highlight");
    const analysisData = await queryAIAnalysis(state, analysisPrompt);

    if (DOM.loaderConsoleBody) {
      await writeConsoleLog(DOM.loaderConsoleBody, "Response received successfully! Validation passed.", 200, "system");
      await writeConsoleLog(DOM.loaderConsoleBody, `Stress Index computed: ${analysisData.stressScore}%`, 150, "highlight");
      await writeConsoleLog(DOM.loaderConsoleBody, "Synthesizing personalized coping strategies...", 150);
      await writeConsoleLog(DOM.loaderConsoleBody, "Finalizing MindCare AI dashboard. Launching...", 200, "system");
    }

    updateState("analysisResult", analysisData);
    updateState("chatHistory", []);
    clearChildren(DOM.dashChatViewport);

    // Persist entry to journal history for emotional pattern tracking
    addJournalEntry({
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      mood: moodVal,
      stressScore: analysisData.stressScore,
      triggers: analysisData.triggers,
      summary: analysisData.outlookSummary
    });

    // Initial companion greeting
    const greeting = `Hi there! I'm Aura, your digital companion. I've looked at your journal entry for today. I can see you're dealing with stress around the **${examName}** exam, especially triggers like *${analysisData.triggers.join(', ')}*. Let's tackle this together. What's on your mind right now?`;
    state.chatHistory.push({ role: "assistant", content: greeting });

    renderDashboardResults(analysisData, state, DOM);
    if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "ai", greeting);

    clearInterval(loaderBreathingInterval);
    if (DOM.loaderBubbleOuter) DOM.loaderBubbleOuter.style.animationPlayState = "paused";

    setTimeout(() => showScreen(DOM.dashboardScreen), 500);

  } catch (err) {
    console.error(err);
    clearInterval(loaderBreathingInterval);
    if (DOM.loaderBubbleOuter) DOM.loaderBubbleOuter.style.animationPlayState = "paused";

    if (DOM.loaderConsoleBody) {
      await writeConsoleLog(DOM.loaderConsoleBody, `API Call failed: ${err.message}`, 100, "error");
      await writeConsoleLog(DOM.loaderConsoleBody, "Please check your network and API credentials.", 150, "error");
      await writeConsoleLog(DOM.loaderConsoleBody, "Returning to journal screen...", 500);
    }
    setTimeout(() => navigateToJournal(), 3500);
  }
}

/** Toggles the 4-7-8 breathing exercise on dashboard. */
function handleBreathingToggle() {
  if (breathingPlayActive) {
    stopBreathingExercise();
    breathingPlayActive = false;
    DOM.btnToggleBreathing.textContent = "Start Exercise";
    DOM.btnToggleBreathing.className = "btn btn-secondary";
    if (DOM.dashBreathingSphere) DOM.dashBreathingSphere.className = "breathing-exercise-sphere";
    if (DOM.dashBreathingInstruction) DOM.dashBreathingInstruction.textContent = "Click Start to begin 4-7-8 breathing.";
    if (DOM.dashBreathingTimer) DOM.dashBreathingTimer.textContent = "0s";
  } else {
    breathingPlayActive = true;
    DOM.btnToggleBreathing.textContent = "Pause Exercise";
    DOM.btnToggleBreathing.className = "btn btn-outline";
    if (DOM.dashBreathingSphere && DOM.dashBreathingTimer && DOM.dashBreathingInstruction) {
      startBreathingExercise(DOM.dashBreathingSphere, DOM.dashBreathingTimer, DOM.dashBreathingInstruction);
    }
  }
}

/** Handles chat companion message submission. */
async function handleChatSubmit(e) {
  e.preventDefault();
  const state = getState();
  if (!DOM.dashChatInput) return;

  const text = DOM.dashChatInput.value.trim();
  if (!text) return;

  DOM.dashChatInput.value = "";
  DOM.dashChatInput.disabled = true;

  if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "user", text);
  state.chatHistory.push({ role: "user", content: text });

  let typingIndicator = null;
  if (DOM.dashChatViewport) typingIndicator = appendChatTypingIndicator(DOM.dashChatViewport);

  const examName = getExamName(state.studentExam);
  const systemPrompt = buildCompanionSystemPrompt(examName, state.currentMood, state.analysisResult?.outlookSummary || state.currentJournal);

  try {
    const messagesSubset = state.chatHistory.slice(-10);
    const reply = await queryAIChat(state, messagesSubset, systemPrompt);
    if (typingIndicator) typingIndicator.remove();
    if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "ai", reply);
    state.chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    console.error(err);
    if (typingIndicator) typingIndicator.remove();
    if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "ai", "I'm sorry, I seem to have trouble connecting right now. Take a deep breath. I'm still here for you.");
  } finally {
    DOM.dashChatInput.disabled = false;
    DOM.dashChatInput.focus();
  }
}

/** Copies analysis report to clipboard. */
function handleCopyAnalysis() {
  const state = getState();
  const res = state.analysisResult;
  if (!res) return;

  const copyText = `MINDCARE AI WELLNESS SUMMARY\nTarget Exam: ${state.studentExam.toUpperCase()}\nReported Mood: ${state.currentMood}\nStress Score: ${res.stressScore}%\nStress Level: ${res.stressLevel}\n\nTriggers Discovered:\n${res.triggers.map(t => `- ${t}`).join('\n')}\n\nSummary Analysis:\n${res.outlookSummary}\n\nActionable Coping Plan:\n${res.copingStrategies.map(c => `- ${c.title}: ${c.description}`).join('\n')}\n\nMindfulness Focus:\n${res.mindfulnessExercise.name} (${res.mindfulnessExercise.type}): ${res.mindfulnessExercise.description}\n\nDaily Encouragement:\n${res.encouragementQuote}\n`;

  navigator.clipboard.writeText(copyText)
    .then(() => alert("Analysis copied to clipboard!"))
    .catch(() => alert("Failed to copy text. Please copy manually."));
}

/** Downloads analysis report as text file. */
function handleDownloadAnalysis() {
  const state = getState();
  const res = state.analysisResult;
  if (!res) return;

  const fileText = `==================================================\n              MINDCARE AI INSIGHTS REPORT\n==================================================\nTarget Exam: ${state.studentExam.toUpperCase()}\nReported Mood: ${state.currentMood.toUpperCase()}\nStress Score: ${res.stressScore}%\nStress Level: ${res.stressLevel}\n\nTRIGGERS IDENTIFIED:\n${res.triggers.map(t => `  - ${t}`).join('\n')}\n\nOUTLOOK ANALYSIS:\n${res.outlookSummary}\n\nPERSONALIZED COPING STRATEGIES:\n${res.copingStrategies.map(c => `  * ${c.title}\n    ${c.description}`).join('\n\n')}\n\nRECOMMENDED MINDFULNESS PRACTICE:\n  Practice: ${res.mindfulnessExercise.name}\n  Type: ${res.mindfulnessExercise.type}\n  Instruction: ${res.mindfulnessExercise.description}\n\nAURA'S ENCOURAGEMENT FOR TODAY:\n  "${res.encouragementQuote}"\n\n==================================================\n  Your mental well-being is vital. Breathe easy.\n==================================================`;

  const blob = new Blob([fileText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mindcare_wellness_report_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Resets dashboard and returns to journal for new entry. */
function handleDashboardRestart() {
  stopBreathingExercise();
  breathingPlayActive = false;
  if (DOM.btnToggleBreathing) {
    DOM.btnToggleBreathing.textContent = "Start Exercise";
    DOM.btnToggleBreathing.className = "btn btn-secondary";
  }
  if (DOM.dashBreathingSphere) DOM.dashBreathingSphere.className = "breathing-exercise-sphere";
  if (DOM.dashBreathingInstruction) DOM.dashBreathingInstruction.textContent = "Click Start to begin 4-7-8 breathing.";
  if (DOM.dashBreathingTimer) DOM.dashBreathingTimer.textContent = "0s";

  if (DOM.journalTextarea) DOM.journalTextarea.value = "";
  if (DOM.charCounter) { DOM.charCounter.textContent = "0 characters"; DOM.charCounter.className = "textarea-char-counter error"; }
  if (DOM.journalForm) DOM.journalForm.reset();

  navigateToJournal();
}

/** Resets all data and returns to welcome screen. */
function handleGlobalReset() {
  const confirmReset = confirm("Are you sure you want to delete all saved configurations, journal history, and API keys from this device?");
  if (!confirmReset) return;

  stopBreathingExercise();
  breathingPlayActive = false;
  resetAllData();

  if (DOM.configForm) DOM.configForm.reset();
  if (DOM.apiProviderSelect) DOM.apiProviderSelect.value = "gemini";
  if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = "none";
  if (DOM.apiBaseUrlInput) DOM.apiBaseUrlInput.value = "";
  if (DOM.apiModelSelect) {
    clearChildren(DOM.apiModelSelect);
    DOM.apiModelSelect.appendChild(createDefaultOption("-- Click Fetch Models --", ""));
  }
  if (DOM.studentExamSelect) DOM.studentExamSelect.value = "jee";
  if (DOM.studentHoursInput) DOM.studentHoursInput.value = "8";
  if (DOM.saveKeyCheckbox) DOM.saveKeyCheckbox.checked = false;
  if (DOM.modelFetchStatus) { DOM.modelFetchStatus.textContent = "Configuration has been reset."; DOM.modelFetchStatus.style.color = ""; }

  if (DOM.journalForm) DOM.journalForm.reset();
  if (DOM.journalTextarea) DOM.journalTextarea.value = "";
  if (DOM.charCounter) DOM.charCounter.textContent = "0 characters";

  alert("Settings and caches wiped successfully.");
  showScreen(DOM.welcomeScreen);
}

/** Binds UI Event Listeners using extracted handler functions. */
function bindEventListeners() {
  // Navigation
  if (DOM.btnGoConfig) DOM.btnGoConfig.addEventListener("click", navigateToConfig);
  if (DOM.btnGoJournal) DOM.btnGoJournal.addEventListener("click", navigateToJournal);
  if (DOM.logoLink) DOM.logoLink.addEventListener("click", (e) => { e.preventDefault(); showScreen(DOM.welcomeScreen); });
  if (DOM.navLinkWelcome) DOM.navLinkWelcome.addEventListener("click", (e) => { e.preventDefault(); showScreen(DOM.welcomeScreen); });
  if (DOM.navLinkConfig) DOM.navLinkConfig.addEventListener("click", (e) => { e.preventDefault(); navigateToConfig(); });
  if (DOM.navLinkJournal) DOM.navLinkJournal.addEventListener("click", (e) => { e.preventDefault(); navigateToJournal(); });

  // Config wizard
  if (DOM.apiProviderSelect) DOM.apiProviderSelect.addEventListener("change", handleProviderChange);
  if (DOM.btnFetchModels) DOM.btnFetchModels.addEventListener("click", handleFetchModels);
  if (DOM.configForm) DOM.configForm.addEventListener("submit", handleConfigSubmit);

  // Wizard step navigation
  if (DOM.btnWizardNext) DOM.btnWizardNext.forEach(btn => {
    btn.addEventListener("click", () => {
      const nextStep = parseInt(btn.getAttribute("data-next"), 10);
      if (validateWizardStep(nextStep - 1, DOM)) { currentWizardStep = nextStep; updateStepIndicator(nextStep); }
    });
  });
  if (DOM.btnWizardPrev) DOM.btnWizardPrev.forEach(btn => {
    btn.addEventListener("click", () => { currentWizardStep = parseInt(btn.getAttribute("data-prev"), 10); updateStepIndicator(currentWizardStep); });
  });

  // Journal
  if (DOM.journalTextarea) DOM.journalTextarea.addEventListener("input", handleJournalInput);
  if (DOM.journalForm) DOM.journalForm.addEventListener("submit", handleJournalSubmit);

  // Dashboard
  if (DOM.btnToggleBreathing) DOM.btnToggleBreathing.addEventListener("click", handleBreathingToggle);
  if (DOM.dashChatForm) DOM.dashChatForm.addEventListener("submit", handleChatSubmit);
  if (DOM.btnCopyAnalysis) DOM.btnCopyAnalysis.addEventListener("click", handleCopyAnalysis);
  if (DOM.btnDownloadAnalysis) DOM.btnDownloadAnalysis.addEventListener("click", handleDownloadAnalysis);
  if (DOM.btnDashboardRestart) DOM.btnDashboardRestart.addEventListener("click", handleDashboardRestart);
  if (DOM.btnGlobalReset) DOM.btnGlobalReset.addEventListener("click", handleGlobalReset);
  if (DOM.btnResetConfig) DOM.btnResetConfig.addEventListener("click", () => { if (DOM.btnGlobalReset) DOM.btnGlobalReset.click(); });
}

/** Restores session settings from local/session storage. */
function restoreStoredConfig() {
  loadConfig();
  const state = getState();

  if (DOM.apiProviderSelect) DOM.apiProviderSelect.value = state.apiProvider;
  if (DOM.apiKeyInput) DOM.apiKeyInput.value = state.apiKey;
  if (DOM.studentExamSelect) DOM.studentExamSelect.value = state.studentExam;
  if (DOM.studentHoursInput) DOM.studentHoursInput.value = state.studentStudyHours.toString();
  if (DOM.saveKeyCheckbox) DOM.saveKeyCheckbox.checked = state.saveKeyPersistent;

  if (state.apiProvider === "openai") {
    if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = "flex";
    if (DOM.apiBaseUrlInput) DOM.apiBaseUrlInput.value = state.apiBaseUrl;
  } else {
    if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = "none";
    if (DOM.apiBaseUrlInput) DOM.apiBaseUrlInput.value = "";
  }

  if (state.apiModel && DOM.apiModelSelect) {
    clearChildren(DOM.apiModelSelect);
    DOM.apiModelSelect.appendChild(createDefaultOption(state.apiModel, state.apiModel));
    DOM.apiModelSelect.value = state.apiModel;
  }
}

// Startup
window.addEventListener("DOMContentLoaded", () => {
  initDomSelectors();
  bindEventListeners();
  restoreStoredConfig();
  showScreen(DOM.welcomeScreen);
});
