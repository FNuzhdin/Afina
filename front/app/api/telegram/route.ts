import {
  isPhotoMessageSchema,
  isTextMessageSchema,
  isUpdateSchema,
  isVideoNoteMesssageSchema,
  isVoiceMesssageSchema,
} from "@/app/utils/Validation";

import { saveMessageRDB } from "@/app/lib/UploadRDB";
import { parseMessage } from "@/app/utils/Parse";
import { voiceToText } from "@/app/lib/VoiceToText";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const headersSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");

  if (headersSecret !== process.env.TELEGRAM_SECRET) {
    console.warn("Unauthorized Telegram request detected");
    return NextResponse.json({
      status: "Unauthorized",
      message: "Only Afina-bot can send requests",
      code: "UNAUTHORIZED_REQUEST",
    });
  }

  (async () => {
    try {
      const update = await req.json();

      if (!isUpdateSchema(update)) {
        console.log("Error:", {
          status: "ignored",
          message: "Update doesn't match telegram-update types",
          code: "INVALID_UPDATE",
        });
        return;
      }

      console.log({
        status: "ok",
        message: "Update received",
        update,
      });

      if (isTextMessageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is text message",
          code: "TEXTMESSAGE_UPDATE",
        });

        // выполняем парс и загрузку сообщения в БД
        const record = parseMessage(update.update_id, update.message, "text");
        console.log({
          message: "message parsed",
          result: record,
        });

        const recordResult = await saveMessageRDB(record);
        console.log({
          message: "massege uploaded in relational database",
          record: recordResult,
        });

        // далее формируем embeddings
        // далее обрабатываем нужен ли ответ от LLM

        // завершаем выполнение серверной функции
        return;
      }

      if (isPhotoMessageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is photo message",
          code: "PHOTOMESSAGE_UPDATE",
        });

        return;
      }

      if (isVoiceMesssageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is voice message",
          code: "VOICEMESSAGE_UPDATE",
        });

        const voice = update.message.voice;
        if (voice.file_size && voice.file_size <= 15 * 1024 * 1024) {
          try {
            const result = await voiceToText(voice.file_id);
            console.log({
              status: "ok",
              message: "Voice to text is success",
              result,
            });
            // берем текст и добавляем в БД
            // потом обрабатываем нужне ли ответ LLM
          } catch (e) {
            console.error({
              status: "error",
              message: e,
              code: "VOICE_TO_TEXT_FAILED",
            });
            // реагируем в тг-чате что ошибка
          }
        } else {
          console.error({
            status: "error",
            message: "Voice file is too large",
            code: "FILE_TOO_LARGE",
          });
          // если нужно реагируем пользователю в тг
        }

        return;
      }

      if (isVideoNoteMesssageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is videonote message",
          code: "VIDEONOTEMESSAGE_UPDATE",
        });
        return;
      }

      console.log({
        status: "ignored",
        message: "Update has unsupported type",
        code: "UNSUPPORTED_TYPE_UPDATE",
      });

      console.dir(update, { depth: null, colors: true });

      return;
    } catch (e) {
      console.error({
        status: "error",
        message: e,
        code: "UNEXPECTED_SERVER_ERROR",
      });
    }
  })();

  return NextResponse.json(null, { status: 200 });
}
