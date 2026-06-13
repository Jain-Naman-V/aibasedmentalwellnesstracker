/**
 * @fileoverview MindCare AI — Main Application Entry & Controller
 * @module main
 */

import { EXAMS, buildAnalysisPrompt, buildCompanionSystemPrompt } from "./config.js";
import { 
  getState, 
  loadConfig, 
  saveConfig, 
  updateState, 
  resetAllData 
} from "./state.js";
import { 
  fetchProviderModels, 
  queryAIAnalysis, 
  queryAIChat 
} from "./api.js";
import { 
  validateJournal, 
  validateUrl, 
  escapeHtml 
} from "./helpers.js";
import { 
  showScreen, 
  updateStepIndicator, 
  validateWizardStep, 
  writeConsoleLog, 
  startBreathingExercise, 
  stopBreathingExercise, 
  renderDashboardResults, 
  appendChatMessage, 
  appendChatTypingIndicator 
} from "./dom.js";

// DOM References collection
let DOM = {};
let currentWizardStep = 1;
let breathingPlayActive = false;

/**
 * Queries and caches all key DOM elements into a centralized reference object.
 * Centralizing DOM element selections improves execution speed by avoiding repeated query lookups
 * and facilitates runtime null-checks for defensive stability across different screens.
 * 
 * @returns {void}
 */
function initDomSelectors() {
  DOM = {
    // Screens
    welcomeScreen: document.getElementById("screen-welcome"),
    configScreen: document.getElementById("screen-config"),
    journalScreen: document.getElementById("screen-journal"),
    loaderScreen: document.getElementById("screen-loader"),
    dashboardScreen: document.getElementById("screen-dashboard"),

    // Global navigation
    btnGoConfig: document.getElementById("btn-go-config"),
    btnGoJournal: document.getElementById("btn-go-journal"),
    logoLink: document.getElementById("logo-link"),
    navLinkWelcome: document.getElementById("nav-welcome"),
    navLinkConfig: document.getElementById("nav-config"),
    navLinkJournal: document.getElementById("nav-journal"),

    // Config form elements
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

    // Wizard navigation
    btnWizardNext: document.querySelectorAll(".btn-wizard-next"),
    btnWizardPrev: document.querySelectorAll(".btn-wizard-prev"),

    // Journal form elements
    journalForm: document.getElementById("journal-form"),
    journalTextarea: document.getElementById("journal-entry"),
    charCounter: document.getElementById("char-counter"),
    journalErrorMsg: document.getElementById("error-journal-entry"),

    // Loader elements
    loaderConsoleBody: document.getElementById("console-logs-body"),
    loaderBreathingText: document.getElementById("loader-breathing-label"),

    // Dashboard elements
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
    
    // Breathing Exercise Dashboard
    dashBreathingSphere: document.getElementById("dash-breathing-sphere"),
    dashBreathingTimer: document.getElementById("dash-breathing-timer"),
    dashBreathingInstruction: document.getElementById("dash-breathing-instruction"),
    btnToggleBreathing: document.getElementById("btn-toggle-breathing"),

    // Companion Chat Dashboard
    dashChatViewport: document.getElementById("dash-chat-messages"),
    dashChatForm: document.getElementById("dash-chat-form"),
    dashChatInput: document.getElementById("dash-chat-input"),

    // Export/Clear buttons
    btnCopyAnalysis: document.getElementById("btn-copy-analysis"),
    btnDownloadAnalysis: document.getElementById("btn-download-analysis"),
    btnDashboardRestart: document.getElementById("btn-dashboard-restart"),
    btnGlobalReset: document.getElementById("btn-global-reset")
  };
}

/**
 * Attaches event listeners to all interactive buttons, select fields, and forms.
 * Employs defensive null-checks for every DOM element selector before attaching the listener
 * to prevent startup crashes if components are loaded or structured dynamically.
 * Coordinates page routing, provider choice toggling, AI model metadata fetches,
 * journal submissions, coping strategies checklist interaction, and report exports.
 * 
 * @returns {void}
 */
function bindEventListeners() {
  const state = getState();

  // Screen Routing Buttons
  if (DOM.btnGoConfig) {
    DOM.btnGoConfig.addEventListener("click", () => {
      currentWizardStep = 1;
      updateStepIndicator(1);
      showScreen(DOM.configScreen);
    });
  }

  if (DOM.btnGoJournal) {
    DOM.btnGoJournal.addEventListener("click", () => {
      if (!state.apiKey) {
        alert("Please configure your API credentials first!");
        currentWizardStep = 1;
        updateStepIndicator(1);
        showScreen(DOM.configScreen);
        return;
      }
      showScreen(DOM.journalScreen);
    });
  }

  if (DOM.logoLink) {
    DOM.logoLink.addEventListener("click", (e) => {
      e.preventDefault();
      showScreen(DOM.welcomeScreen);
    });
  }

  if (DOM.navLinkWelcome) {
    DOM.navLinkWelcome.addEventListener("click", (e) => {
      e.preventDefault();
      showScreen(DOM.welcomeScreen);
    });
  }

  if (DOM.navLinkConfig) {
    DOM.navLinkConfig.addEventListener("click", (e) => {
      e.preventDefault();
      currentWizardStep = 1;
      updateStepIndicator(1);
      showScreen(DOM.configScreen);
    });
  }

  if (DOM.navLinkJournal) {
    DOM.navLinkJournal.addEventListener("click", (e) => {
      e.preventDefault();
      if (!state.apiKey) {
        alert("Please configure your API credentials first!");
        currentWizardStep = 1;
        updateStepIndicator(1);
        showScreen(DOM.configScreen);
        return;
      }
      showScreen(DOM.journalScreen);
    });
  }

  // Toggle API Custom Endpoint Form Group
  if (DOM.apiProviderSelect) {
    DOM.apiProviderSelect.addEventListener("change", () => {
      const provider = DOM.apiProviderSelect.value;
      if (provider === "openai") {
        if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = "flex";
        if (DOM.apiBaseUrlInput) {
          DOM.apiBaseUrlInput.required = true;
          if (!DOM.apiBaseUrlInput.value) {
            DOM.apiBaseUrlInput.value = "https://api.openai.com/v1";
          }
        }
      } else {
        if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = "none";
        if (DOM.apiBaseUrlInput) {
          DOM.apiBaseUrlInput.required = false;
          DOM.apiBaseUrlInput.value = "";
        }
      }
      if (DOM.apiModelSelect) DOM.apiModelSelect.innerHTML = '<option value="">-- Click Fetch Models --</option>';
    });
  }

  // Fetch Models Event
  if (DOM.btnFetchModels) {
    DOM.btnFetchModels.addEventListener("click", async () => {
      const provider = DOM.apiProviderSelect ? DOM.apiProviderSelect.value : "";
      const url = DOM.apiBaseUrlInput ? DOM.apiBaseUrlInput.value.trim() : "";
      const key = DOM.apiKeyInput ? DOM.apiKeyInput.value.trim() : "";

      if (DOM.modelFetchStatus) {
        DOM.modelFetchStatus.textContent = "Loading models...";
        DOM.modelFetchStatus.style.color = "var(--color-text-secondary)";
      }
      DOM.btnFetchModels.disabled = true;

      try {
        let fetchUrl = url;
        if (provider === "gemini") {
          fetchUrl = "https://generativelanguage.googleapis.com";
        }

        if (provider === "openai" && !validateUrl(fetchUrl)) {
          throw new Error("Please enter a valid base URL starting with http:// or https://");
        }

        if (!key && !fetchUrl.includes("localhost") && !fetchUrl.includes("127.0.0.1")) {
          throw new Error("API key is required to retrieve models.");
        }

        const models = await fetchProviderModels(provider, fetchUrl, key);
        
        if (DOM.apiModelSelect) {
          DOM.apiModelSelect.innerHTML = "";
          if (models.length === 0) {
            throw new Error("No available models returned from endpoint.");
          }

          models.forEach(modelId => {
            const opt = document.createElement("option");
            opt.value = modelId;
            opt.textContent = modelId;
            DOM.apiModelSelect.appendChild(opt);
          });
        }

        // Update state temporarily
        updateState("apiKey", key);
        updateState("apiProvider", provider);
        updateState("apiBaseUrl", fetchUrl);
        if (DOM.apiModelSelect) {
          updateState("apiModel", DOM.apiModelSelect.value);
        }

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

        // Inject default options as helper fallbacks
        if (DOM.apiModelSelect) {
          DOM.apiModelSelect.innerHTML = "";
          const defaults = provider === "gemini" ? ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"] : ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
          defaults.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d;
            opt.textContent = `${d} (Fallback)`;
            DOM.apiModelSelect.appendChild(opt);
          });
        }
      } finally {
        DOM.btnFetchModels.disabled = false;
      }
    });
  }

  // Step Wizard Buttons
  if (DOM.btnWizardNext) {
    DOM.btnWizardNext.forEach(btn => {
      btn.addEventListener("click", () => {
        const nextStep = parseInt(btn.getAttribute("data-next"), 10);
        const current = nextStep - 1;

        if (validateWizardStep(current, DOM)) {
          currentWizardStep = nextStep;
          updateStepIndicator(nextStep);
        }
      });
    });
  }

  if (DOM.btnWizardPrev) {
    DOM.btnWizardPrev.forEach(btn => {
      btn.addEventListener("click", () => {
        const prevStep = parseInt(btn.getAttribute("data-prev"), 10);
        currentWizardStep = prevStep;
        updateStepIndicator(prevStep);
      });
    });
  }

  // Config Form Submission
  if (DOM.configForm) {
    DOM.configForm.addEventListener("submit", (e) => {
      e.preventDefault();

      if (!validateWizardStep(3, DOM)) return;

      // Save configurations to state
      if (DOM.apiProviderSelect) updateState("apiProvider", DOM.apiProviderSelect.value);
      if (DOM.apiBaseUrlInput) updateState("apiBaseUrl", DOM.apiBaseUrlInput.value.trim());
      if (DOM.apiKeyInput) updateState("apiKey", DOM.apiKeyInput.value.trim());
      if (DOM.apiModelSelect) updateState("apiModel", DOM.apiModelSelect.value);
      if (DOM.saveKeyCheckbox) updateState("saveKeyPersistent", DOM.saveKeyCheckbox.checked);
      if (DOM.studentExamSelect) updateState("studentExam", DOM.studentExamSelect.value);
      if (DOM.studentHoursInput) updateState("studentStudyHours", parseInt(DOM.studentHoursInput.value, 10));

      // Save to localStorage/sessionStorage
      saveConfig();

      alert("Configuration saved successfully!");
      showScreen(DOM.journalScreen);
    });
  }

  // Journal Text Counter
  if (DOM.journalTextarea) {
    DOM.journalTextarea.addEventListener("input", () => {
      const text = DOM.journalTextarea.value;
      const len = text.length;
      if (DOM.charCounter) {
        DOM.charCounter.textContent = `${len} characters`;

        if (len >= 50) {
          DOM.charCounter.className = "textarea-char-counter";
          if (DOM.journalForm) {
            const formGroup = DOM.journalForm.querySelector(".form-group");
            if (formGroup) formGroup.classList.remove("has-error");
          }
        } else {
          DOM.charCounter.className = "textarea-char-counter error";
        }
      }
    });
  }

  // Journal Entry Form Submission (Analysis trigger)
  if (DOM.journalForm) {
    DOM.journalForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!DOM.journalTextarea) return;
      const journalText = DOM.journalTextarea.value;
      const moodEl = document.querySelector('input[name="mood"]:checked');

      if (!moodEl) {
        alert("Please select your current mood!");
        return;
      }

      if (!validateJournal(journalText)) {
        const formGroup = DOM.journalForm.querySelector(".form-group");
        if (formGroup) formGroup.classList.add("has-error");
        if (DOM.journalErrorMsg) DOM.journalErrorMsg.textContent = "Please write at least 50 characters to allow emotional analysis.";
        DOM.journalTextarea.focus();
        return;
      }

      const moodVal = moodEl.value;
      updateState("currentMood", moodVal);
      updateState("currentJournal", journalText);

      // Swap to Calming Loader Screen
      showScreen(DOM.loaderScreen);
      if (DOM.loaderConsoleBody) DOM.loaderConsoleBody.innerHTML = "";

      // Start breathing animation on loading screen
      let loaderSeconds = 4;
      let loaderPhase = "Inhale";
      if (DOM.loaderBreathingText) DOM.loaderBreathingText.textContent = `${loaderPhase} (4s)`;
      
      // Animate bubble outer
      const bubbleOuter = DOM.loaderScreen ? DOM.loaderScreen.querySelector(".breathing-bubble-outer") : null;
      if (bubbleOuter) {
        bubbleOuter.style.animationPlayState = "running";
      }

      const loaderBreathingInterval = setInterval(() => {
        loaderSeconds--;
        if (loaderSeconds <= 0) {
          if (loaderPhase === "Inhale") {
            loaderPhase = "Hold";
            loaderSeconds = 7;
          } else if (loaderPhase === "Hold") {
            loaderPhase = "Exhale";
            loaderSeconds = 8;
          } else {
            loaderPhase = "Inhale";
            loaderSeconds = 4;
          }
        }
        if (DOM.loaderBreathingText) DOM.loaderBreathingText.textContent = `${loaderPhase} (${loaderSeconds}s)`;
      }, 1000);

      // Typeout simulated console progress
      if (DOM.loaderConsoleBody) {
        await writeConsoleLog(DOM.loaderConsoleBody, "Initializing secure analysis pipeline...", 100, "system");
        await writeConsoleLog(DOM.loaderConsoleBody, `Target Model: ${state.apiModel}`, 200);
        await writeConsoleLog(DOM.loaderConsoleBody, `Mood Logged: ${moodVal}`, 250);
        await writeConsoleLog(DOM.loaderConsoleBody, "Sanitizing input vectors and escaping scripts...", 200, "system");
        await writeConsoleLog(DOM.loaderConsoleBody, "Compiling stress triggers context prompts...", 250);
      }

      // Call Generative AI API
      const selectedExam = EXAMS.find(ex => ex.id === state.studentExam);
      const examName = selectedExam ? selectedExam.name : state.studentExam;
      
      const analysisPrompt = buildAnalysisPrompt(journalText, moodVal, examName, state.studentStudyHours);

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
        
        // Clear chat history for the new companion session
        updateState("chatHistory", []);
        if (DOM.dashChatViewport) DOM.dashChatViewport.innerHTML = "";
        
        // Add first friendly message from companion Aura
        const greeting = `Hi there! I'm Aura, your digital companion. I've looked at your journal entry for today. I can see you're dealing with stress around the **${examName}** exam, especially triggers like *${analysisData.triggers.join(', ')}*. Let's tackle this together. What's on your mind right now?`;
        state.chatHistory.push({ role: "assistant", content: greeting });

        // Render all dashboard metrics
        renderDashboardResults(analysisData, state, DOM);
        
        // Append initial greeting
        if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "ai", greeting);

        // Stop loader interval
        clearInterval(loaderBreathingInterval);
        if (bubbleOuter) {
          bubbleOuter.style.animationPlayState = "paused";
        }

        // Transition to Dashboard screen
        setTimeout(() => {
          showScreen(DOM.dashboardScreen);
        }, 500);

      } catch (err) {
        console.error(err);
        clearInterval(loaderBreathingInterval);
        if (bubbleOuter) {
          bubbleOuter.style.animationPlayState = "paused";
        }

        if (DOM.loaderConsoleBody) {
          await writeConsoleLog(DOM.loaderConsoleBody, `API Call failed: ${err.message}`, 100, "error");
          await writeConsoleLog(DOM.loaderConsoleBody, "Please check your network and API credentials.", 150, "error");
          await writeConsoleLog(DOM.loaderConsoleBody, "Returning to configuration step...", 500);
        }

        setTimeout(() => {
          currentWizardStep = 1;
          updateStepIndicator(1);
          showScreen(DOM.configScreen);
        }, 3500);
      }
    });
  }

  // Breathing Guide Corner Play/Pause Toggle
  if (DOM.btnToggleBreathing) {
    DOM.btnToggleBreathing.addEventListener("click", () => {
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
    });
  }

  // Conversational Chat Buddy Input Submission
  if (DOM.dashChatForm) {
    DOM.dashChatForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!DOM.dashChatInput) return;
      const text = DOM.dashChatInput.value.trim();
      if (!text) return;

      DOM.dashChatInput.value = "";
      DOM.dashChatInput.disabled = true;

      // Render User Message
      if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "user", text);
      state.chatHistory.push({ role: "user", content: text });

      // Show AI typing placeholder
      let typingIndicator = null;
      if (DOM.dashChatViewport) {
        typingIndicator = appendChatTypingIndicator(DOM.dashChatViewport);
      }

      // Call Chat Completion API
      const selectedExam = EXAMS.find(ex => ex.id === state.studentExam);
      const examName = selectedExam ? selectedExam.name : state.studentExam;
      const systemPrompt = buildCompanionSystemPrompt(
        examName,
        state.currentMood,
        state.analysisResult?.outlookSummary || state.currentJournal
      );

      try {
        // Keep only last 10 messages of history to stay highly efficient
        const messagesSubset = state.chatHistory.slice(-10);

        const reply = await queryAIChat(state, messagesSubset, systemPrompt);
        
        // Remove typing bubble
        if (typingIndicator) typingIndicator.remove();

        // Render reply
        if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "ai", reply);
        state.chatHistory.push({ role: "assistant", content: reply });

      } catch (err) {
        console.error(err);
        if (typingIndicator) typingIndicator.remove();
        const errReply = "I'm sorry, I seem to have trouble connecting right now. Take a deep breath. I'm still here for you.";
        if (DOM.dashChatViewport) appendChatMessage(DOM.dashChatViewport, "ai", errReply);
      } finally {
        DOM.dashChatInput.disabled = false;
        DOM.dashChatInput.focus();
      }
    });
  }

  // Export copy
  if (DOM.btnCopyAnalysis) {
    DOM.btnCopyAnalysis.addEventListener("click", () => {
      const res = state.analysisResult;
      if (!res) return;

      const copyText = `MINDCARE AI WELLNESS SUMMARY
Target Exam: ${state.studentExam.toUpperCase()}
Reported Mood: ${state.currentMood}
Stress Score: ${res.stressScore}%
Stress Level: ${res.stressLevel}

Triggers Discovered:
${res.triggers.map(t => `- ${t}`).join('\n')}

Summary Analysis:
${res.outlookSummary}

Actionable Coping Plan:
${res.copingStrategies.map(c => `- ${c.title}: ${c.description}`).join('\n')}

Mindfulness Focus:
${res.mindfulnessExercise.name} (${res.mindfulnessExercise.type}): ${res.mindfulnessExercise.description}

Daily Encouragement:
${res.encouragementQuote}
`;

      navigator.clipboard.writeText(copyText)
        .then(() => alert("Analysis copied to clipboard!"))
        .catch(() => alert("Failed to copy text. Please copy manually."));
    });
  }

  // Export download
  if (DOM.btnDownloadAnalysis) {
    DOM.btnDownloadAnalysis.addEventListener("click", () => {
      const res = state.analysisResult;
      if (!res) return;

      const fileText = `==================================================
              MINDCARE AI INSIGHTS REPORT
==================================================
Target Exam: ${state.studentExam.toUpperCase()}
Reported Mood: ${state.currentMood.toUpperCase()}
Stress Score: ${res.stressScore}%
Stress Level: ${res.stressLevel}

TRIGGERS IDENTIFIED:
${res.triggers.map(t => `  - ${t}`).join('\n')}

OUTLOOK ANALYSIS:
${res.outlookSummary}

PERSONALIZED COPING STRATEGIES:
${res.copingStrategies.map(c => `  * ${c.title}\n    ${c.description}`).join('\n\n')}

RECOMMENDED MINDFULNESS PRACTICE:
  Practice: ${res.mindfulnessExercise.name}
  Type: ${res.mindfulnessExercise.type}
  Instruction: ${res.mindfulnessExercise.description}

AURA'S ENCOURAGEMENT FOR TODAY:
  "${res.encouragementQuote}"

==================================================
  Your mental well-being is vital. Breathe easy.
==================================================`;

      const blob = new Blob([fileText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mindcare_wellness_report_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // Dashboard Restart
  if (DOM.btnDashboardRestart) {
    DOM.btnDashboardRestart.addEventListener("click", () => {
      // Stop any running breathing guides
      stopBreathingExercise();
      breathingPlayActive = false;
      if (DOM.btnToggleBreathing) {
        DOM.btnToggleBreathing.textContent = "Start Exercise";
        DOM.btnToggleBreathing.className = "btn btn-secondary";
      }
      if (DOM.dashBreathingSphere) DOM.dashBreathingSphere.className = "breathing-exercise-sphere";
      if (DOM.dashBreathingInstruction) DOM.dashBreathingInstruction.textContent = "Click Start to begin 4-7-8 breathing.";
      if (DOM.dashBreathingTimer) DOM.dashBreathingTimer.textContent = "0s";

      // Reset journal inputs
      if (DOM.journalTextarea) DOM.journalTextarea.value = "";
      if (DOM.charCounter) {
        DOM.charCounter.textContent = "0 characters";
        DOM.charCounter.className = "textarea-char-counter error";
      }
      if (DOM.journalForm) DOM.journalForm.reset();

      showScreen(DOM.journalScreen);
    });
  }

  // Global Settings Reset
  if (DOM.btnGlobalReset) {
    DOM.btnGlobalReset.addEventListener("click", () => {
      const confirmReset = confirm("Are you sure you want to delete all saved configurations, journal history, and API keys from this device?");
      if (confirmReset) {
        // Stop breathing timers
        stopBreathingExercise();
        breathingPlayActive = false;

        resetAllData();
        
        // Reset config inputs in form
        if (DOM.configForm) DOM.configForm.reset();
        if (DOM.apiProviderSelect) DOM.apiProviderSelect.value = "gemini";
        if (DOM.apiBaseUrlGroup) DOM.apiBaseUrlGroup.style.display = "none";
        if (DOM.apiBaseUrlInput) DOM.apiBaseUrlInput.value = "";
        if (DOM.apiModelSelect) DOM.apiModelSelect.innerHTML = '<option value="">-- Click Fetch Models --</option>';
        if (DOM.studentExamSelect) DOM.studentExamSelect.value = "jee";
        if (DOM.studentHoursInput) DOM.studentHoursInput.value = "8";
        if (DOM.saveKeyCheckbox) DOM.saveKeyCheckbox.checked = false;
        if (DOM.modelFetchStatus) {
          DOM.modelFetchStatus.textContent = "Configuration has been reset.";
          DOM.modelFetchStatus.style.color = "";
        }

        // Reset journal form
        if (DOM.journalForm) DOM.journalForm.reset();
        if (DOM.journalTextarea) DOM.journalTextarea.value = "";
        if (DOM.charCounter) DOM.charCounter.textContent = "0 characters";

        alert("Settings and caches wiped successfully.");
        showScreen(DOM.welcomeScreen);
      }
    });
  }

  // Reset config button inside wizard
  if (DOM.btnResetConfig) {
    DOM.btnResetConfig.addEventListener("click", () => {
      if (DOM.btnGlobalReset) DOM.btnGlobalReset.click();
    });
  }
}

/**
 * Restores and re-hydrates session settings from local or session storage if saved.
 * Updates form values, state variables, and toggles the visibility state of custom
 * endpoint groups depending on whether Gemini or an OpenAI-compatible provider was active.
 * 
 * @returns {void}
 */
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

  // Populate model value
  if (state.apiModel && DOM.apiModelSelect) {
    DOM.apiModelSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = state.apiModel;
    opt.textContent = state.apiModel;
    DOM.apiModelSelect.appendChild(opt);
    DOM.apiModelSelect.value = state.apiModel;
  }
}

/**
 * Core Application Initialization Handler.
 * Sets up selectors, binds event listeners, restores cached user config,
 * and mounts the onboarding welcome screen as the initial viewport.
 */
window.addEventListener("DOMContentLoaded", () => {
  // Initialize and query DOM nodes
  initDomSelectors();
  
  // Attach safe click, change, and submit event listeners
  bindEventListeners();
  
  // Restore any persisted configuration from previous sessions
  restoreStoredConfig();
  
  // Default to showing the welcome onboarding landing screen
  showScreen(DOM.welcomeScreen);
});
