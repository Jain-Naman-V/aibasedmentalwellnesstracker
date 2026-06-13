/**
 * @fileoverview MindCare AI — Configuration Constants & Prompts
 * @module config
 */

export const EXAMS = [
  { id: "jee", name: "JEE (Engineering)" },
  { id: "neet", name: "NEET (Medical)" },
  { id: "upsc", name: "UPSC (Civil Services)" },
  { id: "gate", name: "GATE (Postgraduate Engineering)" },
  { id: "cat", name: "CAT (Management)" },
  { id: "cuet", name: "CUET (University Entrance)" },
  { id: "cbse", name: "CBSE / State Board Exams" },
  { id: "other", name: "Other Competitive Exam" }
];

/**
 * Resolves exam ID to human-readable name.
 * Uses Map for O(1) lookup instead of repeated Array.find().
 * @param {string} examId
 * @returns {string} Human-readable exam name
 */
const EXAM_NAME_MAP = new Map(EXAMS.map(e => [e.id, e.name]));
export function getExamName(examId) {
  return EXAM_NAME_MAP.get(examId) || examId;
}

export const DEFAULT_ENDPOINTS = {
  gemini: "https://generativelanguage.googleapis.com",
  openai: "https://api.openai.com/v1"
};

export const DEFAULT_MODELS = {
  gemini: "gemini-1.5-flash",
  openai: "gpt-4o-mini"
};

/**
 * Prompt builder for student wellness journal analysis.
 * Expects a structured JSON response.
 * @param {string} journalText 
 * @param {string} moodText 
 * @param {string} examName 
 * @param {number} hours 
 * @returns {string} The formatted prompt.
 */
export function buildAnalysisPrompt(journalText, moodText, examName, hours) {
  return `You are MindCare AI, an empathetic, highly specialized student wellness consultant. 
Your goal is to analyze a student's daily journal and mood log to uncover hidden stress triggers and emotional patterns, and provide personalized coping strategies and mindfulness exercises.

[Student Context]
- Target Exam: ${examName}
- Reported Sleep/Daily Study Hours: ${hours} hours
- Selected Mood: ${moodText}
- Journal Entry: "${journalText}"

[Rules]
1. Calculate a realistic "stressScore" (0 to 100) and set "stressLevel" (Low, Moderate, High).
2. Uncover 2-4 hidden "triggers" (e.g., Exam Fear, Peer Pressure, Sleep Deprivation, Time Management, Family Expectations).
3. Draft a warm "outlookSummary" in 2-3 sentences validating their feelings and explaining what the text suggests about their stress patterns.
4. Generate exactly 3 highly personalized, actionable "copingStrategies" with short, motivating titles.
5. Create a "mindfulnessExercise" (e.g., Box breathing, progressive muscle relaxation, 5-4-3-2-1 groundings) specifically tuned to their mood.
6. Provide a warm "encouragementQuote".
7. CRITICAL: You MUST respond ONLY with a raw JSON object that conforms to the schema below. Do not wrap in markdown \`\`\`json block formatting.

[Required JSON Schema]
{
  "stressScore": number (0 to 100),
  "stressLevel": "Low" | "Moderate" | "High",
  "triggers": string[],
  "outlookSummary": string,
  "copingStrategies": [
    { "title": string, "description": string },
    { "title": string, "description": string },
    { "title": string, "description": string }
  ],
  "mindfulnessExercise": {
    "type": string,
    "name": string,
    "description": string
  },
  "encouragementQuote": string
}`;
}

/**
 * System instruction prompt for the Conversational wellness companion.
 * @param {string} examName 
 * @param {string} moodText 
 * @param {string} journalSummary 
 * @returns {string} The system prompt.
 */
export function buildCompanionSystemPrompt(examName, moodText, journalSummary) {
  return `You are Aura, an empathetic, supportive, always-available digital companion for a student preparing for the high-stakes ${examName} exam.
The student has reported feeling "${moodText}" and recently logged this journal summary: "${journalSummary}".

[Personality Rules]
1. Be warm, non-judgmental, active-listening, and highly encouraging. Never sound clinical, robotic, or dismissive.
2. Refer gently to their exam (${examName}) or their daily struggles when contextually appropriate, but keep the focus on emotional support and mental health rather than study planning.
3. Suggest simple, practical coping tactics (like taking a 2-minute stretch, a glass of water, or a breathing pause) directly in the flow of conversation if they are stressed.
4. Keep your responses concise (2-4 sentences max) to avoid overwhelming a student who is already tired.
5. SAFE SPACE LIMITS: If the student mentions self-harm, severe clinical depression, suicide, or crisis, immediately respond with deep empathy and guide them to consult a professional or contact student support hotlines. Keep it safe.`;
}
