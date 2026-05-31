import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

let client = null;

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

function getClient() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

export async function generateText(prompt, options = {}) {
  const groq = getClient();
  if (!groq) throw new Error('Groq API key missing');

  const completion = await groq.chat.completions.create({
    model: options.model || DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 1024
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * @param {string} systemPrompt
 * @param {Array<{ role: string, parts?: Array<{ text: string }>, content?: string }>} history - Gemini-style or OpenAI-style
 * @param {string} userMessage
 */
export async function chatWithHistory(systemPrompt, history, userMessage, options = {}) {
  const groq = getClient();
  if (!groq) throw new Error('Groq API key missing');

  const messages = [{ role: 'system', content: systemPrompt }];

  for (const entry of history) {
    const role = entry.role === 'model' || entry.role === 'assistant' ? 'assistant' : 'user';
    const content = entry.parts?.[0]?.text ?? entry.content ?? '';
    if (content) messages.push({ role, content });
  }

  messages.push({ role: 'user', content: userMessage });

  const completion = await groq.chat.completions.create({
    model: options.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024
  });

  return completion.choices[0]?.message?.content || '';
}

export function parseJsonFromText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty model response');
  }
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  const jsonString = jsonMatch ? jsonMatch[0] : cleaned;
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`Failed to parse JSON from model response: ${err.message}`);
  }
}
