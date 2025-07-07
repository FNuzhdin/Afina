import {
  isBaseMessageSchema,
  isMyChatMemberUpdateSchema,
  isPhotoMessageSchema,
  isTextMessageSchema,
  isVideoNoteMesssageSchema,
  isVoiceMesssageSchema,
} from "@/app/utils/Validation";

import { saveMessageRDB } from "@/app/lib/UploadRDB";
import { parseMessage } from "@/app/utils/Parse";
import { voiceToText } from "@/app/lib/VoiceToText";
import { afina } from "@/app/lib/BotClient";
import { Context } from "grammy";

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

      console.log({
        status: "ok",
        message: "Update received",
        update,
      });
      console.dir(update, { depth: null, colors: true });

      // $ лично только с создателем $
      if (isBaseMessageSchema(update.message)) {
        if (
          update.message.chat.type === "private" &&
          update.message.from.id !== 726008803
        ) {
          console.log({
            status: "ignored",
            message: "Attempt to privately communicate",
            code: "ATTEMPT_PRIVATE",
          });
          const chatId = update.message.chat.id;
          const name = update.message.chat.first_name;
          afina.api.sendMessage(
            chatId,
            `Прости, ${name}, но лично могу общаться только с создателем💔`
          );
          return;
        }
      }

      // $ добавлять в чат может только создатель $
      if (isMyChatMemberUpdateSchema(update)) {
        if (update.my_chat_member) {
          const chat = update.my_chat_member.chat;
          const from = update.my_chat_member.from;

          if(from.id !== 726008803) {
          console.log({
            status: "info",
            message: "Attempt to add to group chat",
            code: "INVITE_IN_CHAT",
            chatId: chat.id,
            addedBy: from?.username || from?.id,
          });

          if (
            chat.type === "group" ||
            chat.type === "supergroup" ||
            chat.type === "channel"
          ) {
            const newStatus = update.my_chat_member.new_chat_member.status;
            if (newStatus === "member" || newStatus === "administrator") {
              try {
                // Отправляем сообщение в чат
                await afina.api.sendMessage(
                  chat.id,
                  "Не хочу никого обидеть, но я ухожу отсюда 👀"
                );

                // Выходим из чата
                await afina.api.leaveChat(chat.id);

                console.log(`Bot left chat ${chat.id}`);
              } catch (e) {
                console.error(
                  "Ошибка при отправке сообщения или выходе из чата",
                  e
                );
              }
            }
          }
          return true; // Обработали обновление
        } }

        // await afina.api.sendMessage(chatId, "Не хочу никого обидеть, но я ухожу отсюда 👀");
        // await afina.api.leaveChat(chatId);
        return;
      }

      // $ работа с текстовым сообщением $
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

        const id = recordResult[0].id;

        // далее формируем embeddings
        // далее обрабатываем нужен ли ответ от LLM

        // завершаем выполнение серверной функции
        return;
      }

      // $ работа с фотографией $
      if (isPhotoMessageSchema(update.message)) {
        console.log({
          status: "ok",
          message: "Message is photo message",
          code: "PHOTOMESSAGE_UPDATE",
        });

        return;
      }

      // $ работа с голосовым сообщением $
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

      // $ работа с кружочком $
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
