# MindCare AI — Empathetic Student Mental Wellness Tracker

MindCare AI is a premium, high-fidelity, and secure client-side application designed to assist students in tracking and managing stress during high-stakes exam preparation (e.g., JEE, NEET, UPSC, GATE). By pairing generative AI insights with interactive mindfulness exercises, the tool acts as a private wellness dashboard.

---

## 🌟 Key Features

1. **Empathetic Onboarding & Setup Wizard**
   - Direct connection setup to Google Gemini API or custom OpenAI-compatible endpoints (such as Ollama or LocalAI).
   - Dynamic model discovery with visual fetch status indicators.
   - Customized student academic profile (exam type, daily study hours).

2. **Daily Wellness Journaling & Mood Logging**
   - Mood selectors utilizing inline vector graphics.
   - Text journal input validating a minimum character length of 50 to ensure robust, actionable insights.

3. **Advanced AI Analysis Dashboard**
   - **Stress Score Gauge**: Circular visual stress index colored and animated dynamically based on stress severity.
   - **Identified Stress Triggers**: Extracting root stressors like peer pressure, insomnia, or academic load.
   - **Daily Coping Plan**: Interactive, checkable strategies to systematically reduce anxiety.
   - **Mindfulness Corner**: Integrated, interactive 4-7-8 breathing exercise guide with dynamic bubble expansion animations.
   - **Empathetic Safeguard Banner**: Automatically triggers regional crisis support hotlines when extreme stress levels or risk keywords are encountered.

4. **Conversational Wellness Companion ("Aura")**
   - Direct, context-aware chat assistant that maintains knowledge of the target exam and triggers.
   - Graceful system styling with custom typing bubbles and markdown parsing.

5. **Defense-in-Depth Security & Data Privacy**
   - Wipes session and credential caches instantly with a "Wipe Cache & Clear Data" utility.
   - Safe rendering of markdown formatting using direct DOM node insertion (`DocumentFragment`), completely neutralizing XSS vectors (zero `innerHTML` usage with dynamic AI content).
   - Obfuscated storage formats for local credentials (both `localStorage` and `sessionStorage`) using salt-key encoding, protecting keys from plaintext device scanners.

---

## 🛠️ Technical Stack & Architecture

- **Core Engine**: Vanilla HTML5, CSS3, and ES6 modules (`type="module"`).
- **Styling**: Modern, responsive CSS system utilizing Outfit and Inter typography with a soothing "Sage-Indigo" color palette.
- **Dependencies**: 0 external runtime dependencies for maximum security.
- **Node.js Environment**: Standard package configuration using native test runner.

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

The codebase includes a dual-verification testing suite checking validations, HTML sanitizers, JSON extractors, and DOM markdown compilers.

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
The page visually displays the list of test cases, durations in milliseconds, assertion parameters, and error traceback logs on failure.

---

## ♿ Accessibility & Security Audit Compliance

- **Aria Attributes & Landmarks**: All screens, form inputs, dynamic dials, progress bars, and alerts are fully labeled with semantic landmarks and appropriate `aria-*` tags. The circular stress gauge functions as an accessible semantic `role="meter"`.
- **Screen Reader Navigation**: Focus states automatically shift to screen headers when changing views, notifying screen readers instantly. Screen reader headings are hidden inside wizard steps for proper keyboard navigation.
- **No InnerHTML with AI Responses**: Every message and coping item is compiled token-by-token and appended as text nodes or DOM elements.
- **Robust JSON Parsing**: Features boundary checking (`{` and `}`) inside raw text responses to handle conversational wrapping styles of different generative models without throwing errors.
