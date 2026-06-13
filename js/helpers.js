/**
 * @fileoverview MindCare AI — Pure Utility Functions & Security Sanitizers
 * @module helpers
 */

/**
 * Validates whether a string is a properly formatted HTTP/HTTPS URL.
 * @param {string} url 
 * @returns {boolean}
 */
export function validateUrl(url) {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/**
 * Validates whether a journal entry has sufficient length for analysis.
 * Minimum length of 50 characters ensures robust AI extraction.
 * @param {string} text 
 * @returns {boolean}
 */
export function validateJournal(text) {
  if (typeof text !== "string") return false;
  return text.trim().length >= 50;
}

/**
 * Sanitizes journal text before sending to AI endpoint.
 * Strips control characters (except newlines/tabs) and collapses excessive whitespace.
 * @param {string} text
 * @returns {string} Cleaned text safe for API transmission
 */
export function sanitizeJournalInput(text) {
  if (typeof text !== "string") return "";
  // Remove control chars except newline (\n) and tab (\t)
  const stripped = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Collapse runs of 3+ newlines into 2, and excessive spaces into 1
  return stripped.replace(/\n{3,}/g, "\n\n").replace(/ {2,}/g, " ").trim();
}

/**
 * Escapes characters that could cause HTML injection or XSS.
 * @param {string} str 
 * @returns {string} Safe escaped string
 */
export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Safely parses basic inline markdown (**bold**, *italic*) and builds safe text nodes.
 * This function returns a DOM Node (DocumentFragment) without ever using innerHTML,
 * preventing any cross-site scripting (XSS) from malicious/unexpected LLM outputs.
 * 
 * @param {string} text 
 * @returns {DocumentFragment} Safe DOM nodes
 */
export function parseInlineMarkdown(text) {
  const fragment = document.createDocumentFragment();
  if (typeof text !== "string" || !text) return fragment;

  // Split by bold tokens first: **bold**
  const boldParts = text.split(/\*\*([\s\S]*?)\*\*/g);

  for (let i = 0; i < boldParts.length; i++) {
    const isBold = i % 2 === 1;
    const part = boldParts[i];

    if (!part) continue;

    // Inside each part, parse italics: *italic* or _italic_
    const italicParts = part.split(/\*([\s\S]*?)\*/g);
    
    for (let j = 0; j < italicParts.length; j++) {
      const isItalic = j % 2 === 1;
      const subPart = italicParts[j];

      if (!subPart) continue;

      let targetNode;
      if (isBold && isItalic) {
        const strong = document.createElement("strong");
        const em = document.createElement("em");
        em.appendChild(document.createTextNode(subPart));
        strong.appendChild(em);
        targetNode = strong;
      } else if (isBold) {
        const strong = document.createElement("strong");
        strong.appendChild(document.createTextNode(subPart));
        targetNode = strong;
      } else if (isItalic) {
        const em = document.createElement("em");
        em.appendChild(document.createTextNode(subPart));
        targetNode = em;
      } else {
        targetNode = document.createTextNode(subPart);
      }
      fragment.appendChild(targetNode);
    }
  }

  return fragment;
}

/**
 * Safely parses multi-line markdown paragraphs and bullet lists.
 * Generates semantic DOM elements and handles nested inline styles.
 * 
 * @param {string} markdownText 
 * @returns {DocumentFragment} Safe multi-line layout nodes
 */
export function parseMarkdownToElements(markdownText) {
  const fragment = document.createDocumentFragment();
  if (typeof markdownText !== "string" || !markdownText) return fragment;

  const lines = markdownText.split("\n");
  let activeList = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      if (activeList) {
        fragment.appendChild(activeList);
        activeList = null;
      }
      continue;
    }

    // Check for bullet list items: starts with "- " or "* "
    if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      if (!activeList) {
        activeList = document.createElement("ul");
      }
      const li = document.createElement("li");
      const liContent = trimmedLine.substring(2);
      li.appendChild(parseInlineMarkdown(liContent));
      activeList.appendChild(li);
    } else {
      // If we were building a list and run into a paragraph, close it
      if (activeList) {
        fragment.appendChild(activeList);
        activeList = null;
      }
      
      const p = document.createElement("p");
      p.appendChild(parseInlineMarkdown(rawLine));
      fragment.appendChild(p);
    }
  }

  // If list is still active at EOF, append it
  if (activeList) {
    fragment.appendChild(activeList);
  }

  return fragment;
}

/**
 * Safely extracts a JSON block from an LLM response text,
 * in case the model wraps the output in ```json ... ``` formatting.
 * 
 * @param {string} rawResponse 
 * @returns {string} Clean JSON string ready for parsing
 */
export function extractJsonString(rawResponse) {
  if (typeof rawResponse !== "string" || !rawResponse) return "";
  let content = rawResponse.trim();

  // Strip triple backticks if they surround the content
  if (content.startsWith("```json")) {
    content = content.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (content.startsWith("```")) {
    content = content.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  content = content.trim();

  // If the model still returned chat wrapping, extract the outermost bracketed object
  const startIdx = content.indexOf("{");
  const endIdx = content.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    content = content.substring(startIdx, endIdx + 1);
  }

  return content.trim();
}
