import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

export type AIProvider = "gemini" | "openai" | "anthropic";

export interface CompletionOptions {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface CompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

// Default provider/model used across the app
export const DEFAULT_PROVIDER: AIProvider = "gemini";
export const DEFAULT_MODEL = "gemini-2.0-flash-lite";

const MODEL_DEFAULTS: Record<AIProvider, string> = {
  gemini: "gemini-2.0-flash-lite",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
};

export function resolveModel(provider: AIProvider, model?: string): string {
  return model ?? MODEL_DEFAULTS[provider];
}

// --- Gemini ---
async function callGemini(
  model: string,
  options: CompletionOptions,
): Promise<CompletionResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: options.systemPrompt,
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 2000,
      ...(options.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  const result = await genModel.generateContent(options.userMessage);
  const response = result.response;
  return {
    text: response.text(),
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// --- OpenAI ---
async function callOpenAI(
  model: string,
  options: CompletionOptions,
): Promise<CompletionResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model,
    max_tokens: options.maxTokens ?? 2000,
    response_format: options.jsonMode ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userMessage },
    ],
  });

  return {
    text: response.choices[0].message.content ?? "",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

// --- Anthropic ---
async function callAnthropic(
  model: string,
  options: CompletionOptions,
): Promise<CompletionResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens ?? 2000,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// --- Public factory ---
export async function complete(
  provider: AIProvider,
  model: string,
  options: CompletionOptions,
): Promise<CompletionResult> {
  switch (provider) {
    case "gemini":
      return callGemini(model, options);
    case "openai":
      return callOpenAI(model, options);
    case "anthropic":
      return callAnthropic(model, options);
  }
}
