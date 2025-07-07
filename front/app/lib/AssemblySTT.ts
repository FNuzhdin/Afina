import { fetch } from "undici";
import fs from "fs";
import {
  isAssemblyAiUploadUrl,
  isAssemblyAiResponseSchema,
  isAssemblyAiResponseErrorSchema,
} from "../utils/Validation";

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
