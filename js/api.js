/**
 * @fileoverview MindCare AI — API Integrations (Gemini & OpenAI Compatibility)
 * @module api
 */

import { extractJsonString } from "./helpers.js";

/**
 * Fetches available models from the selected provider.
 * 
 * @param {string} provider - "gemini" or "openai"
 * @param {string} baseUrl - Custom API URL
 * @param {string} apiKey - API Key
 * @returns {Promise<string[]>} List of model names
 */
export async function fetchProviderModels(provider, baseUrl, apiKey) {
  if (provider === "gemini") {
    if (!apiKey) {
      throw new Error("API Key is required to fetch Gemini models.");
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Gemini Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.models)) {
      return data.models
        .map(m => m.name.replace(/^models\//, ""))
        .filter(name => name.includes("gemini-1.5") || name.includes("gemini-2.0") || name.includes("gemini-pro"));
    }
    throw new Error("Invalid response format from Gemini API.");
  } else {
    // OpenAI or compatible
    const cleanUrl = baseUrl.replace(/\/$/, "");
    if (!cleanUrl) {
      throw new Error("Base URL is required for OpenAI-compatible provider.");
    }
    
    const headers = { "Accept": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${cleanUrl}/models`, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`OpenAI Provider Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.data)) {
      return data.data
        .map(m => m.id)
        .sort((a, b) => a.localeCompare(b));
    }
    throw new Error("Invalid response format from OpenAI-compatible API.");
  }
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

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Gemini HTTP error ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response returned from Gemini API.");

    const cleanedJson = extractJsonString(rawText);
    return JSON.parse(cleanedJson);

  } else {
    // OpenAI or compatible
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

    const response = await fetch(`${cleanUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `OpenAI HTTP error ${response.status}`);
    }

    const data = await response.json();
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

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Gemini HTTP error ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response text found from chat API.");
    return text;

  } else {
    // OpenAI or compatible
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

    const response = await fetch(`${cleanUrl}/chat/completions`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `OpenAI HTTP error ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response text found from chat API.");
    return text;
  }
}
