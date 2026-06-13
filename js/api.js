/**
 * @fileoverview MindCare AI — API Integrations (Gemini & OpenAI Compatibility)
 * @module api
 *
 * Security Notes:
 * - Gemini API uses query-param authentication per Google's official documentation.
 * - All fetch calls use AbortController with a 30-second timeout to prevent hanging.
 * - Response payloads are size-checked before JSON parsing (max 1MB).
 */

import { extractJsonString } from "./helpers.js";

/** Maximum allowed response size in bytes (1MB) to prevent abuse from untrusted endpoints */
const MAX_RESPONSE_BYTES = 1_048_576;
/** Default request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Wraps fetch with an AbortController timeout and response size validation.
 * Centralizes error handling for all API calls.
 *
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options (method, headers, body)
 * @returns {Promise<Response>} Validated response
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 30 seconds. Check your network connection.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Reads response text with size validation to prevent memory exhaustion.
 * @param {Response} response
 * @returns {Promise<Object>} Parsed JSON
 */
async function safeParseJson(response) {
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error("Response exceeds maximum allowed size (1MB).");
  }
  return JSON.parse(text);
}

/**
 * Fetches available models from the selected provider.
 *
 * @param {string} provider - "gemini" or "openai"
 * @param {string} baseUrl - Custom API URL
 * @param {string} apiKey - API Key
 * @returns {Promise<string[]>} List of model names
 */
export async function fetchProviderModels(provider, baseUrl, apiKey) {
  if (apiKey?.toLowerCase().includes("demo") || apiKey?.toLowerCase().includes("mock") || !apiKey) {
    if (provider === "gemini") {
      return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
    } else {
      return ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"];
    }
  }

  if (provider === "gemini") {
    return fetchGeminiModels(apiKey);
  }
  return fetchOpenAIModels(baseUrl, apiKey);
}

/**
 * Fetches Gemini model list from Google's generative language API.
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function fetchGeminiModels(apiKey) {
  if (!apiKey) {
    throw new Error("API Key is required to fetch Gemini models.");
  }
  // Gemini uses query-param auth per official Google AI documentation
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Gemini Error: ${response.status} ${response.statusText}`);
  }

  const data = await safeParseJson(response);
  if (data && Array.isArray(data.models)) {
    return data.models
      .map(m => m.name.replace(/^models\//, ""))
      .filter(name => name.includes("gemini-1.5") || name.includes("gemini-2.0") || name.includes("gemini-pro"));
  }
  throw new Error("Invalid response format from Gemini API.");
}

/**
 * Fetches model list from an OpenAI-compatible endpoint.
 * @param {string} baseUrl
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function fetchOpenAIModels(baseUrl, apiKey) {
  const cleanUrl = baseUrl.replace(/\/$/, "");
  if (!cleanUrl) {
    throw new Error("Base URL is required for OpenAI-compatible provider.");
  }

  const headers = { "Accept": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetchWithTimeout(`${cleanUrl}/models`, {
    method: "GET",
    headers: headers
  });

  if (!response.ok) {
    throw new Error(`OpenAI Provider Error: ${response.status} ${response.statusText}`);
  }

  const data = await safeParseJson(response);
  if (data && Array.isArray(data.data)) {
    return data.data
      .map(m => m.id)
      .sort((a, b) => a.localeCompare(b));
  }
  throw new Error("Invalid response format from OpenAI-compatible API.");
}

/**
 * Performs a single prompt completion, requesting structured JSON output.
 * Uses native JSON modes in Gemini and OpenAI where possible.
 *
 * @param {Object} state - The global app state containing provider, key, model, etc.
 * @param {string} prompt - Prompt to send
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function queryAIAnalysis(state, prompt) {
  const { apiProvider, apiBaseUrl, apiKey, apiModel } = state;

  if (apiKey?.toLowerCase().includes("demo") || apiKey?.toLowerCase().includes("mock") || !apiKey) {
    // Return high-quality mock response instantly
    return {
      stressScore: 78,
      stressLevel: "High Stress",
      triggers: ["NEET Mock Test Scores", "Peer Comparison", "Sleep Deprivation"],
      outlookSummary: "Your journal reveals significant anxiety regarding exam preparations. Peer comparisons and mock test pressure are causing sleep disturbances and self-doubt.",
      copingStrategies: [
        { title: "Avoid Score Comparisons", description: "Take a 48-hour break from discussing test results or preparation speed with friends." },
        { title: "Sleep for Memory Retention", description: "Keep a strict 7-hour bedtime routine. Your brain needs sleep to store formulas." },
        { title: "Interactive Breathing break", description: "Engage with the 4-7-8 breathing bubble below for at least three full cycles." }
      ],
      mindfulnessExercise: {
        name: "4-7-8 Relaxation",
        type: "Breathing",
        description: "Engage in deep relaxation breathing to activate your parasympathetic nervous system."
      },
      encouragementQuote: "A single test does not define your destiny. You are doing your best, and that is always enough."
    };
  }

  if (apiProvider === "gemini") {
    if (!apiKey) throw new Error("Gemini API key is required.");
    const model = apiModel || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Gemini HTTP error ${response.status}`);
    }

    const data = await safeParseJson(response);
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response returned from Gemini API.");

    const cleanedJson = extractJsonString(rawText);
    return JSON.parse(cleanedJson);

  } else {
    // OpenAI or compatible endpoint
    const cleanUrl = apiBaseUrl.replace(/\/$/, "");
    if (!cleanUrl) throw new Error("Base URL is required.");
    const model = apiModel || "gpt-4o-mini";

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const payload = {
      model: model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7
    };

    const response = await fetchWithTimeout(`${cleanUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `OpenAI HTTP error ${response.status}`);
    }

    const data = await safeParseJson(response);
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) throw new Error("Empty response returned from OpenAI provider.");

    const cleanedJson = extractJsonString(rawText);
    return JSON.parse(cleanedJson);
  }
}

/**
 * Handles conversational chat completions with context history.
 *
 * @param {Object} state - Global state
 * @param {Array<Object>} chatMessages - Chat history array of { role, content }
 * @param {string} systemPrompt - Instruction prompt for the assistant
 * @returns {Promise<string>} Text response from the model
 */
export async function queryAIChat(state, chatMessages, systemPrompt) {
  const { apiProvider, apiBaseUrl, apiKey, apiModel } = state;

  if (apiKey?.toLowerCase().includes("demo") || apiKey?.toLowerCase().includes("mock") || !apiKey) {
    // Generate intelligent-sounding mock companion responses
    const lastMsg = chatMessages[chatMessages.length - 1]?.content?.toLowerCase() || "";
    
    // Check for crisis trigger words
    const crisisWords = ["hopeless", "give up", "suicide", "self-harm", "end my life", "kill myself", "burden", "die", "hurt myself"];
    if (crisisWords.some(w => lastMsg.includes(w))) {
      return "I hear how incredibly hard things are right now. Your life has value and you do not have to carry this alone. Please reach out to these free, confidential professional helplines:\n\n🧡 iCall Helpline: +91-9152987821\n🧡 Vandrevala Foundation: 1860-266-2345 (24/7)\n\nPlease contact them. They care, and they are ready to support you. I am here to listen as well.";
    }

    if (lastMsg.includes("fail") || lastMsg.includes("mock") || lastMsg.includes("test") || lastMsg.includes("exam")) {
      return "I completely understand. Mock tests can feel like high-stakes trials, but remember their true purpose is diagnostic practice. They help highlight areas for improvement, not define your capabilities. What specific topic felt most challenging in the test?";
    }
    if (lastMsg.includes("sleep") || lastMsg.includes("tired") || lastMsg.includes("insomnia") || lastMsg.includes("exhausted")) {
      return "Exhaustion is a major stress amplifier. Rest is not a reward for studying, it is an essential part of the cognitive process. Try setting a hard cutoff for study time tonight. Would you like to practice our 4-7-8 breathing exercise to wind down?";
    }
    if (lastMsg.includes("parent") || lastMsg.includes("family") || lastMsg.includes("pressure") || lastMsg.includes("friend")) {
      return "Managing expectations from family or comparing yourself to friends is a huge weight. It helps to have an honest but gentle conversation about your stress, or to set clear study boundaries. You are running your own race at your own pace.";
    }
    return "I hear you, and your feelings are completely valid. Taking a moment to check in and chat is a great wellness step. How can I help you break down your goals into smaller, manageable steps today?";
  }

  if (apiProvider === "gemini") {
    if (!apiKey) throw new Error("Gemini API key is required.");
    const model = apiModel || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Map history to Gemini format. Gemini expects roles: "user" or "model"
    const contents = chatMessages.map(msg => ({
      role: msg.role === "assistant" ? "model" : msg.role,
      parts: [{ text: msg.content }]
    }));

    const payload = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.7
      }
    };

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Gemini HTTP error ${response.status}`);
    }

    const data = await safeParseJson(response);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response text found from chat API.");
    return text;

  } else {
    // OpenAI or compatible endpoint
    const cleanUrl = apiBaseUrl.replace(/\/$/, "");
    if (!cleanUrl) throw new Error("Base URL is required.");
    const model = apiModel || "gpt-4o-mini";

    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Compile messages with system instruction at start
    const messages = [
      { role: "system", content: systemPrompt },
      ...chatMessages
    ];

    const payload = {
      model: model,
      messages: messages,
      temperature: 0.7
    };

    const response = await fetchWithTimeout(`${cleanUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `OpenAI HTTP error ${response.status}`);
    }

    const data = await safeParseJson(response);
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response text found from chat API.");
    return text;
  }
}
