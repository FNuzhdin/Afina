import {
  isPhotoMessageSchema,
  isTextMessageSchema,
  isVideoNoteMesssageSchema,
  isVoiceMesssageSchema,
} from "@/app/utils/Validation";

import {
  cleanRDB,
  isHundredBatch,
  saveMessagesRDB,
  saveSummaryRDB,
  updateStatusSummarized,
} from "@/app/lib/DataBases/RelationalDB";
import { parseMessage, parseSummary } from "@/app/utils/Parse";
import { voiceToText } from "@/app/lib/AI/SpeachToText";
import {
  afina,
  afiOnlyCreator,
  afiUnsupportedType,
  checkMention,
} from "@/app/lib/Bot";

import { NextRequest, NextResponse } from "next/server";
import { chunkText } from "@/app/utils/ChunkText";
import { getEmbeddings } from "@/app/lib/AI/GetEmbeddings";
import { querySimilar, uploadEmbeddings } from "@/app/lib/DataBases/VectorVDB";
import { summaries } from "@/app/lib/AI/LLM";

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

      console.log({
        status: "ok",
        message: "Update received",
        update,
      });
      console.dir(update, { depth: null, colors: true });

      // Только создатель (проверка по id пользователя)
      // может добавлять бота в чат и вести с ним переписку лично
      if (!(await afiOnlyCreator(update))) return;

      // $ работа с текстовым сообщением $
      if (isTextMessageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is text message",
          code: "TEXT_MESSAGE",
        });

        const message = update.message;
        const chatId = message.chat.id; // number
        if (checkMention(message.text)) {
          await afina.api.sendChatAction(chatId, "typing");

          /* тут в отдельной функции формируется ответ от LLM в два такта 
          и отправлятеся пользователю */
          await afina.api.sendMessage(chatId, "Таинственно проигнорирую 😏");
        }

        // парс и получаем массив
        const parsedMessages = parseMessage(
          update.update_id,
          message,
          [message.text],
          "text",
          false
        );

        // загружаем в RDB
        const recordResult = await saveMessagesRDB(parsedMessages);
        console.log({
          message: "message uploaded in relational database",
          record: recordResult,
        });

        const { result, unsummarized: messagesBatch } = await isHundredBatch(
          chatId
        );
        if (!result || messagesBatch === undefined) return;

        console.log("Enough messages to summarize, summarizing...");
        const summaryText = await summaries(messagesBatch);
        await updateStatusSummarized(messagesBatch);
        await cleanRDB(chatId);

        const summaryPayload = parseSummary(messagesBatch, summaryText);
        const summaryId = await saveSummaryRDB(summaryPayload);
        const embeddings = await getEmbeddings([summaryText]);
        console.log({
          status: "ok",
          message: "Embeddings got",
        });
        await uploadEmbeddings([{ id: summaryId, embedding: embeddings[0] }]);

        return;
      }

      // $ работа с голосовым сообщением $
      if (isVoiceMesssageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is voice message",
          code: "VOICE_MESSAGE",
        });

        const voice = update.message.voice;
        if (voice.file_size && voice.file_size <= 15 * 1024 * 1024) {
          try {
            const text = await voiceToText(voice.file_id);
            console.log({
              status: "ok",
              message: "Voice to text is success",
              text,
            });

            if (typeof text === "undefined") {
              console.log({
                status: "error",
                code: "UNDEFINED_RESULT",
              });
              throw new Error("VoiceToText result is undefined");
            }

            const chatId = update.message.chat.id;
            const message = update.message;
            if (checkMention(text)) {
              await afina.api.sendChatAction(chatId, "typing");

              /* тут в отдельной функции формируется ответ от LLM в два такта 
              и отправлятеся пользователю */
              await afina.api.sendMessage(
                chatId,
                "Таинственно проигнорирую 😏"
              );
            }

            // парс и получаем массив
            const parsedMessages = parseMessage(
              update.update_id,
              message,
              [text],
              "voice",
              false
            );

            const recordResult = await saveMessagesRDB(parsedMessages);
            console.log({
              message: "message uploaded in relational database",
              record: recordResult,
            });

            const { result, unsummarized: messagesBatch } =
              await isHundredBatch(chatId);
            if (!result || messagesBatch === undefined) return;

            console.log("Enough messages to summarize, summarizing...");
            const summaryText = await summaries(messagesBatch);
            await updateStatusSummarized(messagesBatch);
            await cleanRDB(chatId);

            const summaryPayload = parseSummary(messagesBatch, summaryText);
            const summaryId = await saveSummaryRDB(summaryPayload);
            const embeddings = await getEmbeddings([summaryText]);
            console.log({
              status: "ok",
              message: "Embeddings got",
            });
            await uploadEmbeddings([
              { id: summaryId, embedding: embeddings[0] },
            ]);

            return;
          } catch (e) {
            console.error({
              status: "error",
              message: e,
              code: "VOICE_TO_TEXT_FAILED",
            });
          }
        } else {
          console.error({
            status: "error",
            message: "Voice file is too large",
            code: "FILE_TOO_LARGE",
          });
        }
        return;
      }

      // $ работа с кружочком $
      if (isVideoNoteMesssageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is videonote message",
          code: "VIDEONOTE_MESSAGE",
        });

        const chat = update.message.chat;
        if (chat.type === "private") {
          await afiUnsupportedType(chat.id);
        }
        return;
      }

      // $ работа с фотографией $
      if (isPhotoMessageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is photo message",
          code: "PHOTO_MESSAGE",
        });

        const chat = update.message.chat;
        const chatId = chat.id;
        const caption = update.message.caption;
        if (chat.type === "private") {
          await afiUnsupportedType(chat.id);
        }

        if (checkMention(caption)) {
          await afina.api.sendChatAction(chatId, "typing");

          /* ответ LLM */
          await afina.api.sendMessage(chatId, "Фото тупо секс, что еще сказать");
        }

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
