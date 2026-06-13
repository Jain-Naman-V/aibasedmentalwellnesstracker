/**
 * @fileoverview Command-Line Unit Test Suite for MindCare AI
 * Runs on Node.js native test runner. Covers helpers, state, and config modules.
 */

import assert from "assert";
import test from "node:test";

// Mock the browser document global object before importing helpers
globalThis.document = {
  createDocumentFragment: () => {
    const children = [];
    return {
      nodeName: "#document-fragment",
      children,
      appendChild: (node) => {
        if (node.nodeName === "#document-fragment") {
          children.push(...node.children);
          node.children.length = 0;
        } else {
          children.push(node);
        }
        return node;
      }
    };
  },
  createElement: (tag) => {
    const children = [];
    return {
      nodeName: tag.toUpperCase(),
      tagName: tag.toUpperCase(),
      children,
      appendChild: (node) => {
        if (node.nodeName === "#document-fragment") {
          children.push(...node.children);
          node.children.length = 0;
        } else {
          children.push(node);
        }
        return node;
      }
    };
  },
  createTextNode: (text) => {
    return {
      nodeName: "#text",
      nodeValue: text
    };
  }
};

// Mock localStorage and sessionStorage for state tests
const createMockStorage = () => {
  const store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
};

globalThis.localStorage = createMockStorage();
globalThis.sessionStorage = createMockStorage();

// Now import the modules
import {
  validateUrl,
  validateJournal,
  escapeHtml,
  extractJsonString,
  parseInlineMarkdown,
  parseMarkdownToElements,
  sanitizeJournalInput
} from "./js/helpers.js";

import {
  getState,
  updateState,
  saveConfig,
  loadConfig,
  resetAllData,
  addJournalEntry
} from "./js/state.js";

import {
  EXAMS,
  getExamName,
  buildAnalysisPrompt,
  buildCompanionSystemPrompt
} from "./js/config.js";

// ==================== HELPER TESTS ====================

test("validateUrl: should accept valid HTTP/HTTPS URLs", () => {
  assert.strictEqual(validateUrl("https://api.openai.com/v1"), true);
  assert.strictEqual(validateUrl("http://localhost:11434"), true);
});

test("validateUrl: should reject non-HTTP schemes and empty strings", () => {
  assert.strictEqual(validateUrl("ftp://api.openai.com"), false);
  assert.strictEqual(validateUrl("api.openai.com"), false);
  assert.strictEqual(validateUrl(""), false);
});

test("validateJournal: should reject entries under 50 characters", () => {
  assert.strictEqual(validateJournal("I feel stressed about my board exams today."), false, "44 chars should fail");
  assert.strictEqual(validateJournal(""), false, "Empty should fail");
});

test("validateJournal: should accept entries at exactly 50 characters", () => {
  const exactly50 = "a".repeat(50);
  assert.strictEqual(validateJournal(exactly50), true, "Exactly 50 chars should pass");
});

test("validateJournal: should accept entries above 50 characters", () => {
  const long = "Preparing for GATE is taking a huge toll on my sleep. I am only studying 12 hours a day and neglecting my wellness.";
  assert.strictEqual(validateJournal(long), true);
});

test("validateJournal: should reject 49 characters (boundary)", () => {
  const exactly49 = "a".repeat(49);
  assert.strictEqual(validateJournal(exactly49), false, "49 chars should fail");
});

test("escapeHtml: should neutralize XSS script tags", () => {
  const dangerous = '<script>alert("hack");</script> & "hello"';
  const expected = '&lt;script&gt;alert(&quot;hack&quot;);&lt;/script&gt; &amp; &quot;hello&quot;';
  assert.strictEqual(escapeHtml(dangerous), expected);
});

test("escapeHtml: should handle single quotes and empty strings", () => {
  assert.strictEqual(escapeHtml("it's"), "it&#039;s");
  assert.strictEqual(escapeHtml(""), "");
});

test("extractJsonString: should strip ```json backtick wrapping", () => {
  const raw = "```json\n{\n  \"stressScore\": 45\n}\n```";
  assert.strictEqual(extractJsonString(raw), "{\n  \"stressScore\": 45\n}");
});

test("extractJsonString: should strip plain ``` backtick wrapping", () => {
  const raw = "```\n{\n  \"stressScore\": 45\n}\n```";
  assert.strictEqual(extractJsonString(raw), "{\n  \"stressScore\": 45\n}");
});

test("extractJsonString: should pass through clean JSON unchanged", () => {
  const raw = "{\n  \"stressScore\": 45\n}";
  assert.strictEqual(extractJsonString(raw), "{\n  \"stressScore\": 45\n}");
});

test("extractJsonString: should handle conversational wrapping around JSON", () => {
  const raw = "Here is your analysis:\n{\"stressScore\": 72}\nHope that helps!";
  assert.strictEqual(extractJsonString(raw), "{\"stressScore\": 72}");
});

test("extractJsonString: should return empty for empty/null inputs", () => {
  assert.strictEqual(extractJsonString(""), "");
  assert.strictEqual(extractJsonString(null), "");
});

test("parseInlineMarkdown: should create STRONG elements for bold text", () => {
  const frag = parseInlineMarkdown("This is **bold** text");
  assert.strictEqual(frag.children.length, 3);
  assert.strictEqual(frag.children[0].nodeValue, "This is ");
  assert.strictEqual(frag.children[1].tagName, "STRONG");
  assert.strictEqual(frag.children[1].children[0].nodeValue, "bold");
});

test("parseInlineMarkdown: should create EM elements for italic text", () => {
  const frag = parseInlineMarkdown("I am *anxious*");
  assert.strictEqual(frag.children.length, 2);
  assert.strictEqual(frag.children[1].tagName, "EM");
});

test("parseMarkdownToElements: should parse paragraphs and lists", () => {
  const markdown = "Hello student.\n\n- Take a breath\n- Walk outside\n\nHope this helps.";
  const frag = parseMarkdownToElements(markdown);
  assert.strictEqual(frag.children.length, 3);
  assert.strictEqual(frag.children[0].tagName, "P");
  assert.strictEqual(frag.children[1].tagName, "UL");
  assert.strictEqual(frag.children[1].children.length, 2);
  assert.strictEqual(frag.children[2].tagName, "P");
});

test("parseMarkdownToElements: should handle asterisk bullet lists", () => {
  const markdown = "* Item one\n* Item two";
  const frag = parseMarkdownToElements(markdown);
  assert.strictEqual(frag.children.length, 1);
  assert.strictEqual(frag.children[0].tagName, "UL");
  assert.strictEqual(frag.children[0].children.length, 2);
});

test("sanitizeJournalInput: should strip control characters", () => {
  const dirty = "Hello\x00World\x07Test\x1FEnd";
  const cleaned = sanitizeJournalInput(dirty);
  assert.strictEqual(cleaned, "HelloWorldTestEnd");
});

test("sanitizeJournalInput: should collapse excessive whitespace", () => {
  const dirty = "Hello   World\n\n\n\n\nEnd";
  const cleaned = sanitizeJournalInput(dirty);
  assert.strictEqual(cleaned, "Hello World\n\nEnd");
});

test("sanitizeJournalInput: should preserve newlines and tabs", () => {
  const text = "Line 1\nLine 2\tTabbed";
  assert.strictEqual(sanitizeJournalInput(text), "Line 1\nLine 2\tTabbed");
});

test("sanitizeJournalInput: should handle non-string types safely", () => {
  assert.strictEqual(sanitizeJournalInput(null), "");
  assert.strictEqual(sanitizeJournalInput(undefined), "");
  assert.strictEqual(sanitizeJournalInput(123), "");
});

// ==================== DEFENSIVE INPUT TESTS ====================

test("defensive types: all validators handle null/undefined/number safely", () => {
  assert.strictEqual(validateUrl(null), false);
  assert.strictEqual(validateUrl(undefined), false);
  assert.strictEqual(validateUrl(123), false);
  assert.strictEqual(validateJournal(null), false);
  assert.strictEqual(validateJournal(undefined), false);
  assert.strictEqual(validateJournal(123), false);
  assert.strictEqual(escapeHtml(null), "");
  assert.strictEqual(escapeHtml(undefined), "");
  assert.strictEqual(escapeHtml(123), "");
  assert.strictEqual(extractJsonString(null), "");
  assert.strictEqual(extractJsonString(undefined), "");
  assert.strictEqual(extractJsonString(123), "");
});

test("defensive types: markdown parsers return empty fragments for invalid input", () => {
  const frag1 = parseInlineMarkdown(null);
  assert.strictEqual(frag1.children.length, 0);
  const frag2 = parseMarkdownToElements(null);
  assert.strictEqual(frag2.children.length, 0);
});

// ==================== STATE TESTS ====================

test("updateState: should update known keys", () => {
  updateState("apiProvider", "openai");
  assert.strictEqual(getState().apiProvider, "openai");
  updateState("apiProvider", "gemini");
});

test("updateState: should ignore unknown keys", () => {
  const before = { ...getState() };
  updateState("nonExistentKey", "value");
  assert.strictEqual(getState().nonExistentKey, undefined);
});

test("updateState: should accept null for nullable fields", () => {
  updateState("analysisResult", null);
  assert.strictEqual(getState().analysisResult, null);
});

test("saveConfig and loadConfig: should round-trip provider settings", () => {
  updateState("apiProvider", "openai");
  updateState("apiBaseUrl", "https://api.test.com/v1");
  updateState("apiModel", "gpt-4o");
  updateState("studentExam", "neet");
  updateState("studentStudyHours", 12);
  saveConfig();

  // Reset state manually
  updateState("apiProvider", "gemini");
  updateState("apiBaseUrl", "");
  updateState("apiModel", "");

  // Reload
  loadConfig();
  const s = getState();
  assert.strictEqual(s.apiProvider, "openai");
  assert.strictEqual(s.apiBaseUrl, "https://api.test.com/v1");
  assert.strictEqual(s.apiModel, "gpt-4o");
  assert.strictEqual(s.studentExam, "neet");
  assert.strictEqual(s.studentStudyHours, 12);

  // Cleanup
  resetAllData();
});

test("saveConfig: should obfuscate API key in sessionStorage by default", () => {
  updateState("apiKey", "sk-test-key-123");
  updateState("saveKeyPersistent", false);
  saveConfig();

  const raw = sessionStorage.getItem("mindcare_api_key_secure");
  assert.notStrictEqual(raw, "sk-test-key-123", "Key must not be stored in plaintext");
  assert.ok(raw.length > 0, "Obfuscated key must exist");

  resetAllData();
});

test("saveConfig: should store API key in localStorage when persistent", () => {
  updateState("apiKey", "persistent-key-456");
  updateState("saveKeyPersistent", true);
  saveConfig();

  const raw = localStorage.getItem("mindcare_api_key_secure");
  assert.notStrictEqual(raw, "persistent-key-456", "Key must not be plaintext");
  assert.ok(raw.length > 0);

  // Verify session is cleared
  assert.strictEqual(sessionStorage.getItem("mindcare_api_key_secure"), null);

  resetAllData();
});

test("loadConfig: should restore obfuscated API key correctly", () => {
  updateState("apiKey", "round-trip-key");
  updateState("saveKeyPersistent", true);
  saveConfig();

  updateState("apiKey", "");
  loadConfig();
  assert.strictEqual(getState().apiKey, "round-trip-key");

  resetAllData();
});

test("resetAllData: should clear all state to defaults", () => {
  updateState("apiProvider", "openai");
  updateState("apiKey", "secret");
  updateState("studentExam", "upsc");
  saveConfig();

  resetAllData();
  const s = getState();
  assert.strictEqual(s.apiProvider, "gemini");
  assert.strictEqual(s.apiKey, "");
  assert.strictEqual(s.studentExam, "jee");
  assert.strictEqual(s.studentStudyHours, 8);
  assert.deepStrictEqual(s.chatHistory, []);
  assert.deepStrictEqual(s.journalHistory, []);
});

test("addJournalEntry: should persist entries and cap at 30", () => {
  resetAllData();

  // Add 32 entries
  for (let i = 0; i < 32; i++) {
    addJournalEntry({ date: `Day ${i}`, mood: "stressed", stressScore: 50 + i, triggers: ["test"], summary: `Entry ${i}` });
  }

  const history = getState().journalHistory;
  assert.strictEqual(history.length, 30, "History should be capped at 30");
  assert.strictEqual(history[0].date, "Day 2", "Oldest entries should be trimmed");
  assert.strictEqual(history[29].date, "Day 31", "Newest should be last");

  resetAllData();
});

test("addJournalEntry: should handle invalid input gracefully", () => {
  resetAllData();
  addJournalEntry(null);
  addJournalEntry(undefined);
  addJournalEntry("not an object");
  assert.strictEqual(getState().journalHistory.length, 0);
  resetAllData();
});

// ==================== CONFIG TESTS ====================

test("EXAMS: should contain expected exam entries", () => {
  assert.ok(EXAMS.length >= 8, "Should have at least 8 exam options");
  const ids = EXAMS.map(e => e.id);
  assert.ok(ids.includes("jee"), "Must include JEE");
  assert.ok(ids.includes("neet"), "Must include NEET");
  assert.ok(ids.includes("upsc"), "Must include UPSC");
  assert.ok(ids.includes("gate"), "Must include GATE");
});

test("EXAMS: each entry should have id and name strings", () => {
  EXAMS.forEach(exam => {
    assert.strictEqual(typeof exam.id, "string");
    assert.strictEqual(typeof exam.name, "string");
    assert.ok(exam.id.length > 0);
    assert.ok(exam.name.length > 0);
  });
});

test("getExamName: should resolve known exam IDs to names", () => {
  assert.strictEqual(getExamName("jee"), "JEE (Engineering)");
  assert.strictEqual(getExamName("neet"), "NEET (Medical)");
  assert.strictEqual(getExamName("upsc"), "UPSC (Civil Services)");
});

test("getExamName: should return raw ID for unknown exams", () => {
  assert.strictEqual(getExamName("unknown-exam"), "unknown-exam");
  assert.strictEqual(getExamName(""), "");
});

test("buildAnalysisPrompt: should include all student context parameters", () => {
  const prompt = buildAnalysisPrompt("I feel stressed", "stressed", "JEE", 10);
  assert.ok(prompt.includes("JEE"), "Prompt must include exam name");
  assert.ok(prompt.includes("10"), "Prompt must include study hours");
  assert.ok(prompt.includes("stressed"), "Prompt must include mood");
  assert.ok(prompt.includes("I feel stressed"), "Prompt must include journal text");
  assert.ok(prompt.includes("stressScore"), "Prompt must request stressScore");
  assert.ok(prompt.includes("copingStrategies"), "Prompt must request copingStrategies");
});

test("buildAnalysisPrompt: should request JSON schema output", () => {
  const prompt = buildAnalysisPrompt("test", "okay", "NEET", 8);
  assert.ok(prompt.includes("JSON"), "Prompt must mention JSON");
  assert.ok(prompt.includes("triggers"), "Prompt must request triggers");
  assert.ok(prompt.includes("mindfulnessExercise"), "Prompt must request mindfulness");
});

test("buildCompanionSystemPrompt: should include exam and mood context", () => {
  const prompt = buildCompanionSystemPrompt("GATE", "overwhelmed", "Student is very tired");
  assert.ok(prompt.includes("GATE"), "Must include exam");
  assert.ok(prompt.includes("overwhelmed"), "Must include mood");
  assert.ok(prompt.includes("Student is very tired"), "Must include journal summary");
  assert.ok(prompt.includes("Aura"), "Must reference companion name");
});

test("buildCompanionSystemPrompt: should include safety guidelines", () => {
  const prompt = buildCompanionSystemPrompt("JEE", "stressed", "summary");
  assert.ok(prompt.toLowerCase().includes("self-harm") || prompt.toLowerCase().includes("crisis"), "Must include safety rules");
});
