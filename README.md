# MindCare AI — Empathetic Student Mental Wellness Tracker

MindCare AI is a premium, high-fidelity, and secure client-side application designed to assist students in tracking and managing stress during high-stakes exam preparation (e.g., JEE, NEET, UPSC, GATE). By pairing generative AI insights with interactive mindfulness exercises, the tool acts as a private wellness dashboard.

---

## 🌟 Key Features

1. **Empathetic Onboarding & Setup Wizard**
   - Direct connection setup to Google Gemini API or custom OpenAI-compatible endpoints (such as Ollama or LocalAI).
   - Dynamic model discovery with visual fetch status indicators.
   - Customized student academic profile (exam type, daily study hours).

2. **Daily Wellness Journaling & Mood Logging**
   - Mood selectors utilizing inline vector graphics with full keyboard and screen reader support.
   - Text journal input validating a minimum character length of 50 to ensure robust, actionable insights.
   - Input sanitization removes control characters and normalizes whitespace before AI processing.

3. **Emotional Pattern Tracking Across Sessions**
   - Persists journal history (up to 30 entries) to track stress trends over time.
   - Displays recent emotional patterns with mood, stress scores, and identified triggers.
   - Enables students to observe their progress and recurring stress themes.

4. **Advanced AI Analysis Dashboard**
   - **Stress Score Gauge**: Circular visual stress index colored and animated dynamically based on stress severity, with `role="meter"` accessibility.
   - **Identified Stress Triggers**: Extracting root stressors like peer pressure, insomnia, or academic load.
   - **Daily Coping Plan**: Interactive, checkable strategies with accessible `<label>` associations.
   - **Mindfulness Corner**: Integrated, interactive 4-7-8 breathing exercise guide with dynamic bubble expansion animations.
   - **Empathetic Safeguard Banner**: Automatically triggers regional crisis support hotlines when extreme stress levels or risk keywords are encountered (expanded detection: 12+ crisis keywords).

5. **Conversational Wellness Companion ("Aura")**
   - Direct, context-aware chat assistant that maintains knowledge of the target exam and triggers.
   - Safe rendering via `DocumentFragment`-based markdown parsing (zero `innerHTML` with untrusted content).
   - Chat history limited to last 10 messages for optimal API efficiency.

6. **Defense-in-Depth Security & Data Privacy**
   - Wipes session and credential caches instantly with a "Wipe Cache & Clear Data" utility.
   - Safe rendering of markdown formatting using direct DOM node insertion (`DocumentFragment`), completely neutralizing XSS vectors — **zero `innerHTML` usage with any dynamic content**.
   - Obfuscated storage formats for local credentials (both `localStorage` and `sessionStorage`) using salt-key encoding, protecting keys from plaintext device scanners.
   - Content Security Policy (CSP) meta tag restricting script sources and connection targets.
   - All external links include `rel="noopener noreferrer"` to prevent tabnapping.
   - All API calls use `AbortController` with 30-second timeouts to prevent hanging.
   - Response payloads are size-validated (max 1MB) before JSON parsing.
   - Runtime type validation on state mutations via `updateState()`.

---

## 🛠️ Technical Stack & Architecture

- **Core Engine**: Vanilla HTML5, CSS3, and ES6 modules (`type="module"`).
- **Styling**: Modern, responsive CSS system utilizing Outfit and Inter typography with a soothing "Sage-Indigo" color palette.
- **Dependencies**: 0 external runtime dependencies for maximum security.
- **Node.js Environment**: Standard package configuration using native test runner.
- **Module Structure**:
  - `js/config.js` — Constants, exam definitions, prompt builders
  - `js/state.js` — State management, local/session storage, journal history
  - `js/helpers.js` — Input validation, sanitization, HTML escaping, markdown parsing
  - `js/api.js` — Gemini & OpenAI API integrations with timeout/size guards
  - `js/dom.js` — Screen management, dashboard rendering, breathing exercises, chat UI
  - `js/main.js` — Application controller with extracted, named event handlers

---

## 🚀 Installation & Running Locally

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Clone & Setup
Clone the repository or navigate to the project directory:
```bash
npm install
```

### 2. Start Local Development Server
Launch a local development server of your choice. You can use Python's built-in server:
```bash
python3 -m http.server 3000
```
Or use the npm server utility:
```bash
npx serve -l 3000 .
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🧪 Testing Protocol

The codebase includes a comprehensive dual-verification testing suite with **41 test cases** covering helpers, state management, configuration, input sanitization, security escaping, JSON extraction, markdown parsing, and defensive edge cases.

### 1. Command-Line Unit Tests (Node.js native runner)
Run the automated test runner locally in your terminal:
```bash
npm test
```

### 2. Browser-Based Visual Test Runner
To run tests directly inside the browser DOM environment, start your local server and navigate to:
```
http://localhost:3000/test.html
```
The page visually displays categorized test cases with section headers, durations in milliseconds, assertion parameters, and error traceback logs on failure.

---

## ♿ Accessibility & Security Audit Compliance

- **Aria Attributes & Landmarks**: All screens, form inputs, dynamic dials, progress bars, and alerts are fully labeled with semantic landmarks and appropriate `aria-*` tags. The circular stress gauge functions as an accessible semantic `role="meter"`.
- **Mood Radio Labels**: All mood selector radio buttons include `aria-label` attributes for screen reader clarity.
- **Live Regions**: Character counter (`aria-live="polite"`), model fetch status (`aria-live="polite"`), breathing timer (`role="timer"` + `aria-live="polite"`), and breathing instructions (`aria-live="assertive"`) announce dynamic changes.
- **Screen Reader Navigation**: Focus states automatically shift to screen headers when changing views, notifying screen readers instantly. Screen reader headings are hidden inside wizard steps for proper keyboard navigation.
- **Reduced Motion**: `prefers-reduced-motion` media query disables all animations (orbs, breathing bubbles, typing dots, transitions) for users who prefer reduced motion.
- **No InnerHTML with Dynamic Content**: Every message, coping item, trigger pill, and model option is compiled via DOM API (`createElement`, `createTextNode`, `replaceChildren`) — zero innerHTML usage with any dynamic content.
- **Robust JSON Parsing**: Features boundary checking (`{` and `}`) inside raw text responses to handle conversational wrapping styles of different generative models without throwing errors.
- **Accessible Coping Checklist**: Each coping strategy checkbox has a properly associated `<label>` element for click and screen reader targeting.
