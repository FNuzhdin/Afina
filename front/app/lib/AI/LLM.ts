import { TextMessageReturnRecordSchema } from "@/app/utils/Validation";
import { z } from "zod/v4";

import {
  decideConfigPromt,
  decideRetellingPromt,
  summariesPromt,
  identityPromt,
} from "./Promts";

export interface LLMConfigResult {
  systemPrompt: string;
  temperature: number;
  max_tokens: number;
  contextLevel:
    | "out of context"
    | "immediate сontext"
    | "surface chat context"
    | "detailed chat context";
}

export interface FirstStageResult {
  systemPrompt: string;
  temperature: number;
  max_tokens: number;
  summariesTexts?: string[];
  rawMessages?: string[];
}

export interface LLMRetellingConfig {
  retelling: boolean;
  messagesCount: number;
}

// for script
export async function summariesText(unsummarized: string[]): Promise<string> {
  const texts = unsummarized.join("\n");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: summariesPromt,
          },
          {
            role: "user",
            content: texts,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Summarize failed. Proplem with request to OpenRouter.ai");
  }

  const result = await response.json();
  const summaryText: string = result.choices[0].message.content;
  console.log("☑️ Summary LLM result is correct");

  return summaryText;
}

export async function summaries(
  unsummarized: z.infer<typeof TextMessageReturnRecordSchema>[]
): Promise<string> {
  const texts = unsummarized
    .map((msg: z.infer<typeof TextMessageReturnRecordSchema>) => `${msg.date}. ${msg.text}`)
    .join("\n");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: summariesPromt,
          },
          {
            role: "user",
            content: texts,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Summarize failed. Proplem with request to OpenRouter.ai");
  }

  const result = await response.json();
  const summaryText: string = result.choices[0].message.content;
  console.log("☑️ Summary LLM result is correct");

  return summaryText;
}

export async function decideReplyConfig(
  userText: string
): Promise<LLMConfigResult> {
  console.log(
    "🧠 Decide system (response config).",
    `User request: ${userText}`
  );

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: decideConfigPromt },
          {
            role: "user",
            content: `Запрос пользователя: ${userText}.`,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get config from LLM");
  }

  const result = await response.json();
  const reply = result.choices[0].message.content;

  // Парсим JSON
  let config: LLMConfigResult;
  try {
    config = JSON.parse(reply);
  } catch {
    throw new Error(`Invalid LLM JSON: ${reply}`);
  }

  console.log("☑️ Decision to create a config.");
  console.log(`🎚️ Сontext level: ${config.contextLevel}`);

  return config;
}

export async function composeFinalReply(
  userText: string,
  config: FirstStageResult
): Promise<string> {
  const finalSystemPromt = (
    identityPromt +
    ` Сейчас: ${config.systemPrompt}. И твои max_tokens:${
      config.max_tokens - 10
    }`
  ).trim();

  const contextParts: string[] = [];

  if (config.summariesTexts) {
    contextParts.push(
      `Исторические саммери:\n${
        config.summariesTexts.join("\n") || "нет данных"
      }`
    );
  }
  if (config.rawMessages && config.rawMessages.length > 0) {
    contextParts.push(
      `Последние сырые сообщения:\n${config.rawMessages.join("\n")}`
    );
  }

  const context = contextParts.join("\n\n");

  console.log("☑️ Context formed");

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        messages: [
          { role: "system", content: finalSystemPromt },
          {
            role: "user",
            content: `Контекст: ${context}. \n\n
            Новый запрос пользователя: ${userText}`,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get reply from OpenRouter.");
  }

  const result = await response.json();
  const finalReply = result.choices[0].message.content;

  console.log("🧠 LLM response is ok");

  return finalReply;
}

export async function retelling(userText: string): Promise<LLMRetellingConfig> {
  console.log("🧠Decide system (retelling).", `User request: ${userText}`);

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: decideRetellingPromt },
          {
            role: "user",
            content: `Запрос пользователя: ${userText}.`,
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get decision from LLM");
  }

  const result = await response.json();
  const replyJSON = result.choices[0].message.content;

  console.log(replyJSON);

  let retellingConfig: LLMRetellingConfig;
  try {
    retellingConfig = JSON.parse(replyJSON);
  } catch {
    throw new Error(`Invalid LLM JSON: ${replyJSON}`);
  }

  return retellingConfig;
}
