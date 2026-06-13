/**
 * @fileoverview Command-Line Unit Test Suite for MindCare AI Helpers
 * Runs on Node.js native test runner.
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

// Now import the helpers
import { 
  validateUrl, 
  validateJournal, 
  escapeHtml, 
  extractJsonString, 
  parseInlineMarkdown, 
  parseMarkdownToElements 
} from "./js/helpers.js";

test("validateUrl helper checks", () => {
  assert.strictEqual(validateUrl("https://api.openai.com/v1"), true);
  assert.strictEqual(validateUrl("http://localhost:11434"), true);
  assert.strictEqual(validateUrl("ftp://api.openai.com"), false);
  assert.strictEqual(validateUrl("api.openai.com"), false);
  assert.strictEqual(validateUrl(""), false);
});

test("validateJournal length threshold checks", () => {
  const shortText = "I feel stressed about my board exams today.";
  const boundaryText = "I feel stressed about my board exams today. I need to write at least fifty characters.";
  const longText = "Preparing for GATE is taking a huge toll on my sleep. I am only studying 12 hours a day and neglecting my wellness. I hope this tracker can give me some coping mechanism.";
  
  assert.strictEqual(validateJournal(shortText), false, "Short journal under 50 characters should fail");
  assert.strictEqual(validateJournal(boundaryText), true, "Boundary journal above 50 characters should pass");
  assert.strictEqual(validateJournal(longText), true, "Long journal should pass");
  assert.strictEqual(validateJournal(""), false, "Empty journal should fail");
});

test("escapeHtml security sanitizer", () => {
  const dangerous = '<script>alert("hack");</script> & "hello"';
  const expected = '&lt;script&gt;alert(&quot;hack&quot;);&lt;/script&gt; &amp; &quot;hello&quot;';
  assert.strictEqual(escapeHtml(dangerous), expected);
  assert.strictEqual(escapeHtml(""), "");
});

test("extractJsonString backticks extractor", () => {
  const rawWithBackticks = "```json\n{\n  \"stressScore\": 45\n}\n```";
  const rawBasicBackticks = "```\n{\n  \"stressScore\": 45\n}\n```";
  const rawNormal = "{\n  \"stressScore\": 45\n}";

  assert.strictEqual(extractJsonString(rawWithBackticks), "{\n  \"stressScore\": 45\n}");
  assert.strictEqual(extractJsonString(rawBasicBackticks), "{\n  \"stressScore\": 45\n}");
  assert.strictEqual(extractJsonString(rawNormal), "{\n  \"stressScore\": 45\n}");
  assert.strictEqual(extractJsonString(""), "");
});

test("parseInlineMarkdown formatter", () => {
  const frag1 = parseInlineMarkdown("This is **bold** text");
  assert.strictEqual(frag1.children.length, 3);
  assert.strictEqual(frag1.children[0].nodeValue, "This is ");
  assert.strictEqual(frag1.children[1].tagName, "STRONG");
  assert.strictEqual(frag1.children[1].children[0].nodeValue, "bold");
  assert.strictEqual(frag1.children[2].nodeValue, " text");

  const frag2 = parseInlineMarkdown("I am *anxious*");
  assert.strictEqual(frag2.children.length, 2);
  assert.strictEqual(frag2.children[0].nodeValue, "I am ");
  assert.strictEqual(frag2.children[1].tagName, "EM");
  assert.strictEqual(frag2.children[1].children[0].nodeValue, "anxious");
});

test("parseMarkdownToElements block renderer", () => {
  const markdown = "Hello student.\n\n- Take a breath\n- Walk outside\n\nHope this helps.";
  const frag = parseMarkdownToElements(markdown);
  
  // Elements should be: Paragraph, UL, Paragraph
  assert.strictEqual(frag.children.length, 3);
  assert.strictEqual(frag.children[0].tagName, "P");
  assert.strictEqual(frag.children[0].children[0].nodeValue, "Hello student.");
  
  assert.strictEqual(frag.children[1].tagName, "UL");
  assert.strictEqual(frag.children[1].children.length, 2);
  assert.strictEqual(frag.children[1].children[0].tagName, "LI");
  assert.strictEqual(frag.children[1].children[0].children[0].nodeValue, "Take a breath");
  
  assert.strictEqual(frag.children[2].tagName, "P");
  assert.strictEqual(frag.children[2].children[0].nodeValue, "Hope this helps.");
});

test("defensive input types validation tests", () => {
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

  const frag1 = parseInlineMarkdown(null);
  assert.strictEqual(frag1.children.length, 0);

  const frag2 = parseMarkdownToElements(null);
  assert.strictEqual(frag2.children.length, 0);
});
