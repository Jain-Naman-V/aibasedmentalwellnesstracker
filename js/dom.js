/**
 * @fileoverview MindCare AI — DOM Manipulations, Visual Renderers, & Dynamic Handlers
 * @module dom
 */

import { EXAMS } from "./config.js";
import { parseMarkdownToElements, escapeHtml } from "./helpers.js";

// Global Interval references
let breathingInterval = null;
let breathingSeconds = 0;
let breathingPhase = "inhale"; // "inhale", "hold", "exhale"

/**
 * Transitions the view to a new screen.
 * Automatically handles Accessibility by transferring focus to the target screen's header.
 * 
 * @param {HTMLElement} screenToShow 
 */
export function showScreen(screenToShow) {
  const screens = document.querySelectorAll(".screen");
  screens.forEach(s => {
    s.classList.remove("active");
  });
  
  screenToShow.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Focus Management for Screen Readers
  const header = screenToShow.querySelector("h1, h2");
  if (header) {
    header.setAttribute("tabindex", "-1");
    header.focus();
  }
}

/**
 * Updates the step indicator line and highlights the active sub-section in the configuration form.
 * 
 * @param {number} step - Current step (1, 2, or 3)
 */
export function updateStepIndicator(step) {
  // Toggle step sections
  document.querySelectorAll(".wizard-step-section").forEach(sec => {
    sec.classList.remove("active");
    if (parseInt(sec.getAttribute("data-step"), 10) === step) {
      sec.classList.add("active");
    }
  });

  // Calculate percentage
  const percent = ((step - 1) / 2) * 100;
  const fill = document.getElementById("wizard-progress-fill");
  if (fill) {
    fill.style.width = `${percent}%`;
  }

  // Accessibility
  const tracker = document.querySelector(".steps-progress-bar");
  if (tracker) {
    tracker.setAttribute("aria-valuenow", step.toString());
  }
}

/**
 * Validates form fields for a given configuration wizard step.
 * 
 * @param {number} step 
 * @param {Object} domElements 
 * @returns {boolean} True if all inputs are valid
 */
export function validateWizardStep(step, domElements) {
  let isValid = true;

  if (step === 1) {
    // Validate API URL (if custom OpenAI provider)
    const provider = domElements.apiProviderSelect.value;
    if (provider === "openai") {
      const urlVal = domElements.apiBaseUrlInput.value.trim();
      const parent = domElements.apiBaseUrlInput.closest(".form-group");
      if (!urlVal || !urlVal.startsWith("http")) {
        parent.classList.add("has-error");
        domElements.apiBaseUrlInput.setAttribute("aria-invalid", "true");
        isValid = false;
      } else {
        parent.classList.remove("has-error");
        domElements.apiBaseUrlInput.setAttribute("aria-invalid", "false");
      }
    }

    // Validate API Key
    const keyVal = domElements.apiKeyInput.value.trim();
    const parentKey = domElements.apiKeyInput.closest(".form-group");
    // Keys are required unless they are pointing to a local host Ollama endpoint
    const url = domElements.apiBaseUrlInput.value.trim();
    const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");

    if (!keyVal && !isLocalhost) {
      parentKey.classList.add("has-error");
      domElements.apiKeyInput.setAttribute("aria-invalid", "true");
      isValid = false;
    } else {
      parentKey.classList.remove("has-error");
      domElements.apiKeyInput.setAttribute("aria-invalid", "false");
    }
  }

  if (step === 2) {
    // Validate Study Hours Range (1 - 24)
    const hoursVal = parseInt(domElements.studentHoursInput.value, 10);
    const parentHours = domElements.studentHoursInput.closest(".form-group");
    if (isNaN(hoursVal) || hoursVal < 1 || hoursVal > 24) {
      parentHours.classList.add("has-error");
      domElements.studentHoursInput.setAttribute("aria-invalid", "true");
      isValid = false;
    } else {
      parentHours.classList.remove("has-error");
      domElements.studentHoursInput.setAttribute("aria-invalid", "false");
    }
  }

  return isValid;
}

/**
 * Types out log lines slowly inside the console container to create an immersive, calming transition.
 * 
 * @param {HTMLElement} consoleBody - Container element
 * @param {string} text - Message text
 * @param {number} delay - Interval delay
 * @param {string} type - Class identifier ("system", "highlight", "error")
 * @returns {Promise<void>} Resolves when logging line is rendered
 */
export function writeConsoleLog(consoleBody, text, delay, type = "") {
  return new Promise(resolve => {
    setTimeout(() => {
      const line = document.createElement("div");
      line.className = `console-log-line ${type}`;
      line.textContent = `> ${text}`;
      consoleBody.appendChild(line);
      consoleBody.scrollTop = consoleBody.scrollHeight;
      resolve();
    }, delay);
  });
}

/**
 * Sets up the interactive 4-7-8 breathing exercise timers.
 * Cycles: Inhale (4s), Hold (7s), Exhale (8s)
 * 
 * @param {HTMLElement} sphereEl - Bubble element to scale
 * @param {HTMLElement} timerEl - Timer text display
 * @param {HTMLElement} instructionEl - Instruction label text
 */
export function startBreathingExercise(sphereEl, timerEl, instructionEl) {
  if (breathingInterval) {
    clearInterval(breathingInterval);
  }

  breathingSeconds = 4;
  breathingPhase = "inhale";
  
  sphereEl.className = "breathing-exercise-sphere inhale";
  timerEl.textContent = `${breathingSeconds}s`;
  instructionEl.textContent = "Breathe in slowly through your nose...";

  breathingInterval = setInterval(() => {
    breathingSeconds--;

    if (breathingSeconds <= 0) {
      // Transition phases
      if (breathingPhase === "inhale") {
        breathingPhase = "hold";
        breathingSeconds = 7;
        sphereEl.className = "breathing-exercise-sphere hold";
        instructionEl.textContent = "Hold your breath calmly...";
      } else if (breathingPhase === "hold") {
        breathingPhase = "exhale";
        breathingSeconds = 8;
        sphereEl.className = "breathing-exercise-sphere exhale";
        instructionEl.textContent = "Exhale slowly through your mouth, letting go of tension...";
      } else {
        breathingPhase = "inhale";
        breathingSeconds = 4;
        sphereEl.className = "breathing-exercise-sphere inhale";
        instructionEl.textContent = "Breathe in slowly through your nose...";
      }
    }

    timerEl.textContent = `${breathingSeconds}s`;
  }, 1000);
}

/**
 * Stops the breathing guide timers.
 */
export function stopBreathingExercise() {
  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
  }
}

/**
 * Renders the analyzed student wellness results onto the dashboard page.
 * 
 * @param {Object} data - Parsed AI JSON response
 * @param {Object} state - Current global application state
 * @param {Object} domElements - Object collection of dashboard elements
 */
export function renderDashboardResults(data, state, domElements) {
  const selectedExam = EXAMS.find(e => e.id === state.studentExam);
  const examName = selectedExam ? selectedExam.name : state.studentExam;
  
  // Update Header details
  domElements.dashSubtitleMeta.textContent = `Target Exam: ${examName} • Daily study: ${state.studentStudyHours} hrs • Mood: ${state.currentMood.toUpperCase()}`;

  // Update Stress Gauge
  const score = Math.max(0, Math.min(100, data.stressScore));
  domElements.dashStressScoreText.textContent = `${score}`;

  if (domElements.dashStressGaugeMeter) {
    domElements.dashStressGaugeMeter.setAttribute("aria-valuenow", score.toString());
    domElements.dashStressGaugeMeter.setAttribute("aria-valuetext", `${score}% stress index, stress level is ${data.stressLevel}`);
  }

  // Color coordinate gauge fill based on score levels
  let stressClass = "stress-low";
  if (score > 70) {
    stressClass = "stress-high";
  } else if (score > 35) {
    stressClass = "stress-med";
  }

  domElements.dashStressGaugeFill.className = `stress-gauge-fill ${stressClass}`;
  
  // Calculate SVG stroke offset: (2 * PI * r) = 2 * 3.14159 * 60 = ~377
  // offset 0 is full gauge, 377 is empty gauge
  const strokeOffset = 377 - (377 * score) / 100;
  domElements.dashStressGaugeFill.style.strokeDashoffset = strokeOffset.toString();

  // Set stress headline
  domElements.dashStressHeadline.textContent = `Stress Level: ${data.stressLevel}`;

  // Render Triggers
  domElements.dashTriggersList.innerHTML = "";
  if (Array.isArray(data.triggers) && data.triggers.length > 0) {
    data.triggers.forEach(trigger => {
      const pill = document.createElement("span");
      pill.className = "trigger-tag-pill";
      pill.textContent = trigger;
      domElements.dashTriggersList.appendChild(pill);
    });
  } else {
    const pill = document.createElement("span");
    pill.className = "trigger-tag-pill";
    pill.style.backgroundColor = "var(--color-sage-light)";
    pill.style.color = "var(--color-sage)";
    pill.style.borderColor = "rgba(82,121,111,0.2)";
    pill.textContent = "No Major Triggers Detected";
    domElements.dashTriggersList.appendChild(pill);
  }

  // Render Summary
  domElements.dashSummaryText.textContent = data.outlookSummary;

  // Render Coping Checklist
  domElements.dashCopingList.innerHTML = "";
  if (Array.isArray(data.copingStrategies)) {
    data.copingStrategies.forEach((strategy, index) => {
      const li = document.createElement("li");
      li.className = "coping-task-item";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "coping-task-checkbox";
      check.id = `coping-strategy-check-${index}`;

      const details = document.createElement("div");
      details.className = "coping-task-details";

      const title = document.createElement("h4");
      title.textContent = strategy.title;

      const desc = document.createElement("p");
      desc.textContent = strategy.description;

      details.appendChild(title);
      details.appendChild(desc);

      li.appendChild(check);
      li.appendChild(details);

      domElements.dashCopingList.appendChild(li);

      // Interactive completed toggling
      check.addEventListener("change", () => {
        if (check.checked) {
          li.classList.add("completed");
        } else {
          li.classList.remove("completed");
        }
      });
    });
  }

  // Render Encouragement Quote
  domElements.dashEncouragementQuote.textContent = `"${data.encouragementQuote}"`;

  // Render Crisis helpline block if score exceeds 85 or key words matched
  const needsCrisisBlock = score >= 85 || 
    state.currentJournal.toLowerCase().includes("suicide") || 
    state.currentJournal.toLowerCase().includes("kill myself") ||
    state.currentJournal.toLowerCase().includes("end my life") ||
    state.currentJournal.toLowerCase().includes("give up completely");

  if (needsCrisisBlock) {
    domElements.dashCrisisBanner.style.display = "flex";
  } else {
    domElements.dashCrisisBanner.style.display = "none";
  }
}

/**
 * Appends a message bubble inside the companion chat area.
 * Uses safe text rendering to avoid HTML injection.
 * 
 * @param {HTMLElement} chatViewport - Message list container
 * @param {string} role - "user" or "ai"
 * @param {string} content - Message text
 */
export function appendChatMessage(chatViewport, role, content) {
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;

  // Safe formatting parsing: maps Markdown (bold/lists) to elements
  const elements = parseMarkdownToElements(content);
  bubble.appendChild(elements);

  chatViewport.appendChild(bubble);
  chatViewport.scrollTop = chatViewport.scrollHeight;
}

/**
 * Appends a visual typing indicator element inside the chat.
 * 
 * @param {HTMLElement} chatViewport 
 * @returns {HTMLElement} The indicator node reference for removal later
 */
export function appendChatTypingIndicator(chatViewport) {
  const bubble = document.createElement("div");
  bubble.className = "chat-typing-bubble";
  bubble.id = "chat-typing-indicator";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    bubble.appendChild(dot);
  }

  chatViewport.appendChild(bubble);
  chatViewport.scrollTop = chatViewport.scrollHeight;
  return bubble;
}
