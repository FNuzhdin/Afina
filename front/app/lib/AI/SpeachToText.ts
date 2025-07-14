import { fetch } from "undici";
import fs from "fs";
import {
  isAssemblyAiUploadUrl,
  isAssemblyAiResponseSchema,
  isAssemblyAiResponseErrorSchema,
} from "../../utils/Validation";

import { join } from "node:path";
import { createWriteStream, mkdirSync } from "node:fs";
import { pipeline } from "node:stream/promises";

import { isTelegramFileInfoSchema } from "../../utils/Validation";

export async function uploadAudio(filePath: string): Promise<string> {
  const fileStream = fs.createReadStream(filePath);

  const response = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: process.env.ASSEMBLYAI_API_KEY!, // assembly не требует Bearer
      // передается по частям (чанкамим)
    },
    body: fileStream, // undici корректно обработает поток
    duplex: "half" // означает, что тело может быть потоковым, но ответ 
    // пока не закрыт 
  });

  if (!response.ok) {
    throw new Error(`Failed to upload audio: ${await response.text()}`);
  }

  const data = await response.json();
  if (!isAssemblyAiUploadUrl(data)) {
    throw new Error(`Invalid assemblyai response:${JSON.stringify(data)}`);
  }

  return data.upload_url;
}

export async function transcribeAudio(audioUrl: string) {
  const response = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: process.env.ASSEMBLYAI_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audio_url: audioUrl, language_code: "ru" }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start transcription: ${await response.text()}`);
  }

  const data = await response.json();
  if (!isAssemblyAiResponseSchema(data)) {
    throw new Error(`Invalid assemblyai response:${JSON.stringify(data)}`);
  }

  return data.id;
}

export async function getTranscriptionResult(transcriptId: string) {
  while (true) {
    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY! },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch transcription result: ${await response.text()}`
      );
    }

    const data = await response.json();

    if (isAssemblyAiResponseErrorSchema(data)) {
      throw new Error(`AssemblyAI error: ${data.error}`);
    }

    if (!isAssemblyAiResponseSchema(data)) {
      throw new Error(`Invalid assemblyai response: ${JSON.stringify(data)}`);
    }

    if (data.status === "completed") {
      return data.text!;
    }

    await new Promise((r) => setTimeout(r, 3000));
  }
}

export async function voiceToText(fileId: string): Promise<string | undefined> {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!BOT_TOKEN || !OPENROUTER_API_KEY) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY");
  }

  console.log({
    status: "ok",
    message: "config is good"
  });

  const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
  const rawFileInfo = await fetch(getFileUrl).then((res) => res.json());

  if (!isTelegramFileInfoSchema(rawFileInfo)) {
    throw new Error(
      `Invalid Telegram file info: ${JSON.stringify(rawFileInfo)}`
    );
  }

  if (!rawFileInfo.ok) {
    throw new Error(`Failed to get file info: ${JSON.stringify(rawFileInfo)}`);
  }

  const filePath = rawFileInfo.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

  console.log({
    status: "ok",
    message: "file path fetched"
  });

  const tempDir = join(process.cwd(), "temp");
  mkdirSync(tempDir, { recursive: true });

  const localFilePath = join(tempDir, `${fileId}.ogg`);
  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download file: ${downloadUrl}`);
  }

  console.log({
    status: "ok",
    message: "Telegram bytes stream fetched"
  });

  const fileStream = createWriteStream(localFilePath);
  await pipeline(response.body as unknown as NodeJS.ReadableStream, fileStream);

  const upload_url = await uploadAudio(localFilePath);
  const dataId = await transcribeAudio(upload_url);
  const result = await getTranscriptionResult(dataId);

  console.log({
    status: "ok",
    message: "Text received from voice",
    result
  });

  if(!result) return;
  
  return result;
}