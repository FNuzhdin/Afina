// import { join } from "node:path";
// import { createWriteStream, mkdirSync } from "node:fs";
// import { pipeline } from "node:stream/promises";
// import { fetch } from "undici";

// import { isTelegramFileInfoSchema } from "../utils/Validation";
// import { getTranscriptionResult, transcribeAudio, uploadAudio } from "./SpeachToText";

// export async function voiceToText(fileId: string): Promise<string | undefined> {
//   const BOT_TOKEN = process.env.BOT_TOKEN;
//   const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

//   if (!BOT_TOKEN || !OPENROUTER_API_KEY) {
//     throw new Error("Missing TELEGRAM_BOT_TOKEN or OPENROUTER_API_KEY");
//   }

//   console.log({
//     status: "ok",
//     message: "config is good"
//   });

//   const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
//   const rawFileInfo = await fetch(getFileUrl).then((res) => res.json());

//   if (!isTelegramFileInfoSchema(rawFileInfo)) {
//     throw new Error(
//       `Invalid Telegram file info: ${JSON.stringify(rawFileInfo)}`
//     );
//   }

//   if (!rawFileInfo.ok) {
//     throw new Error(`Failed to get file info: ${JSON.stringify(rawFileInfo)}`);
//   }

//   const filePath = rawFileInfo.result.file_path;
//   const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

//   console.log({
//     status: "ok",
//     message: "file path fetched"
//   });

//   const tempDir = join(process.cwd(), "temp");
//   mkdirSync(tempDir, { recursive: true });

//   const localFilePath = join(tempDir, `${fileId}.ogg`);
//   const response = await fetch(downloadUrl);
//   if (!response.ok || !response.body) {
//     throw new Error(`Failed to download file: ${downloadUrl}`);
//   }

//   console.log({
//     status: "ok",
//     message: "Telegram bytes stream fetched"
//   });

//   const fileStream = createWriteStream(localFilePath);
//   await pipeline(response.body as unknown as NodeJS.ReadableStream, fileStream);

//   const upload_url = await uploadAudio(localFilePath);
//   const dataId = await transcribeAudio(upload_url);
//   const result = await getTranscriptionResult(dataId);

//   console.log({
//     status: "ok",
//     message: "Text received from voice",
//     result
//   });

//   if(!result) return;
  
//   return result;
// }


