import {
  isPhotoMessageSchema,
  isTextMessageSchema,
  isVideoMessageSchema,
  isVideoNoteMesssageSchema,
  isVoiceMesssageSchema,
} from "@/app/utils/Validation";

import {
  cleanRDB,
  getLastSummary,
  getRawMessages,
  getSummaryCount,
  getUnsummarized,
  isHundredBatch,
  saveMessagesRDB,
  saveSummaryRDB,
  summariesById,
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
import { getEmbeddings } from "@/app/lib/AI/GetEmbeddings";
import { querySimilar, uploadEmbeddings } from "@/app/lib/DataBases/VectorVDB";
import { composeFinalReply, summaries } from "@/app/lib/AI/LLM";
import { decideReplyConfig } from "@/app/lib/AI/LLM";
import { retelling } from "@/app/lib/AI/LLM";

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
      console.log("Update received");
      console.dir(update, { depth: null, colors: true });

      // Только создатель (проверка по id пользователя)
      // может добавлять бота в чат и вести с ним переписку лично
      if (!(await afiOnlyCreator(update))) return;

      // $ работа с текстовым сообщением $
      if (isTextMessageSchema(update.message)) {
        console.log("✉️ Text message received");

        const message = update.message;
        const chatId = message.chat.id; // number
        const nameAndText = `${
          message.from.first_name ||
          message.from.username ||
          message.from.last_name ||
          message.from.id
        }: ${message.text}`;
        if (
          checkMention(message.text) ||
          message.chat.type === "private" ||
          message?.reply_to_message?.from.username === "Afi_ai_bot"
        ) {
          await afinaResponse(
            chatId,
            nameAndText,
            message.date,
            message.message_id,
            message.from.id
          );
        }

        // парс и получаем массив
        const parsedMessages = parseMessage(
          update.update_id,
          message,
          [nameAndText],
          "text",
          false
        );

        // загружаем в RDB
        const recordResult = await saveMessagesRDB(parsedMessages); // ok
        console.log("💾 Message uploaded in relational database");
        console.log("💾 Record:", recordResult);

        const { result, unsummarized: messagesBatch } = await isHundredBatch(
          chatId
        ); // ok
        if (!result || messagesBatch === undefined) return;

        console.log("☑️ Enough messages to summarize, summarizing...");
        const summaryText = await summaries(messagesBatch); // ok
        await updateStatusSummarized(messagesBatch); // ok
        await cleanRDB(chatId); // ok

        const summaryPayload = parseSummary(messagesBatch, summaryText); // ok
        const summaryId = await saveSummaryRDB(summaryPayload); // ok
        const embedding = await getEmbeddings([summaryText]);
        console.log("☑️ Embeddings got");
        await uploadEmbeddings([{ id: summaryId, embedding: embedding[0] }]);

        return;
      }

      // $ работа с голосовым сообщением $
      if (isVoiceMesssageSchema(update.message)) {
        console.log("✉️ Voice message received");

        const voice = update.message.voice;
        if (voice.file_size && voice.file_size <= 15 * 1024 * 1024) {
          try {
            const text = await voiceToText(voice.file_id);
            console.log("🗣️ Voice to text is success");

            if (typeof text === "undefined") {
              console.log({
                status: "error",
                code: "UNDEFINED_RESULT",
              });
              throw new Error("VoiceToText result is undefined");
            }

            const chatId = update.message.chat.id;
            const message = update.message;
            const nameAndText = `${
              message.from.first_name ||
              message.from.username ||
              message.from.last_name ||
              message.from.id
            }: ${text}`;
            if (
              checkMention(text) ||
              message.chat.type === "private" ||
              message.reply_to_message.from.username === "Afi_ai_bot"
            ) {
              await afinaResponse(
                chatId,
                nameAndText,
                message.date,
                message.message_id,
                message.from.id
              );
            }

            // парс и получаем массив
            const parsedMessages = parseMessage(
              update.update_id,
              message,
              [nameAndText],
              "voice",
              false
            );

            const recordResult = await saveMessagesRDB(parsedMessages);
            console.log("💾 Message uploaded in relational database");
            console.log("💾 Record:", recordResult);

            const { result, unsummarized: messagesBatch } =
              await isHundredBatch(chatId);
            if (!result || messagesBatch === undefined) return;

            console.log("☑️ Enough messages to summarize, summarizing...");
            const summaryText = await summaries(messagesBatch);
            await updateStatusSummarized(messagesBatch);
            await cleanRDB(chatId);

            const summaryPayload = parseSummary(messagesBatch, summaryText);
            const summaryId = await saveSummaryRDB(summaryPayload);
            const embeddings = await getEmbeddings([summaryText]);
            console.log("☑️ Embeddings got");
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
        console.log("✉️ Videonote message received");

        const chat = update.message.chat;
        if (chat.type === "private") {
          await afiUnsupportedType(chat.id);
        }
        return;
      }

      // $ работа с видео $
      if (isVideoMessageSchema(update.message)) {
        console.log("✉️ Video message received");

        const chat = update.message.chat;
        if (chat.type === "private") {
          await afiUnsupportedType(chat.id);
        }
        return;
      }

      // $ работа с фотографией $
      if (isPhotoMessageSchema(update.message)) {
        console.log("✉️ Photo message received");

        const chat = update.message.chat;
        const chatId = chat.id;
        const message = update.message;
        const caption = update.message.caption;
        if (chat.type === "private") {
          await afiUnsupportedType(chat.id);
        }

        if (
          checkMention(caption) ||
          chat.type === "private" ||
          message.reply_to_message.from.username === "Afi_ai_bot"
        ) {
          await afina.api.sendChatAction(chatId, "typing");

          /* ответ LLM */
          await afina.api.sendMessage(
            chatId,
            "Фото тупо секс, что еще сказать"
          );
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

async function necesseryContext(chatId: number): Promise<string[]> {
  const unsummarized = await getUnsummarized(chatId); // исправлено
  let summariesTexts: string[] = [];
  if (unsummarized.length < 50 && unsummarized.length !== 0) {
    console.log("unsummarized.length < 50 && unsummarized.length !== 0");

    const lastSummary = await getLastSummary(chatId); // исправлено
    const fastSummary = await summaries(unsummarized); // исправлено

    if (lastSummary.length === 0) {
      summariesTexts = [
        ...summariesTexts,
        `Быстрый саммери по последним сообщениям: ${fastSummary}`,
      ];
    } else {
      summariesTexts = [
        ...summariesTexts,
        `${lastSummary[0].date_from}-${lastSummary[0].date_to}:${lastSummary[0].text}`,
        `Быстрый саммери по последним сообщениям: ${fastSummary}`,
      ];
    }
  }

  if (unsummarized.length > 50) {
    console.log("unsummarized.length > 50");
    const fastSummary = await summaries(unsummarized); // ok
    summariesTexts = [
      ...summariesTexts,
      `Быстрый саммери по последним сообщениям:${fastSummary}`,
    ];
  }

  if (unsummarized.length === 0) {
    console.log("unsummarized.length === 0");

    const lastSummary = await getLastSummary(chatId);
    if (lastSummary.length === 0) {
      summariesTexts = [...summariesTexts];
    } else {
      summariesTexts = [
        ...summariesTexts,
        `${lastSummary[0].date_from}-${lastSummary[0].date_to}:${lastSummary[0].text}`,
      ];
    }
  }

  console.log("☑️ The necessary context is formed");

  return summariesTexts;
}

async function afinaResponse(
  chatId: number,
  nameAndText: string,
  messageDate: number,
  messageId: number,
  userId: number
) {
  await afina.api.sendChatAction(chatId, "typing");

  const retellingConfig = await retelling(nameAndText);
  if (retellingConfig.retelling) {
    console.log("💬 Retelling request");

    const messagesCount = retellingConfig.messagesCount;
    console.log("Messges count:", messagesCount);

    try {
      if (messagesCount <= 20) {
        await afina.api.sendMessage(
          chatId,
          "Так мало? Прочти самостоятельно, пж ;)",
          { reply_to_message_id: messageId }
        );

        return;
      }
      const unsummarized = await getUnsummarized(chatId);
      const summariesCount = await getSummaryCount(chatId);
      const isAvailableCount =
        unsummarized.length + summariesCount * 100 >= messagesCount;

      if (!isAvailableCount) {
        await afina.api.sendMessage(
          chatId,
          "Прости, но столько сообщений, еще не было написано 😔",
          { reply_to_message_id: messageId }
        );

        return;
      }

      if (messagesCount >= 21 && messagesCount <= 100) {
        if (unsummarized.length > messagesCount - 1) {
          const trimmedUnsummarized = unsummarized
            .reverse()
            .slice(0, messagesCount - 1);
          console.log(trimmedUnsummarized.map((t) => t.text));
          const fastSummary = await summaries(trimmedUnsummarized);

          try {
            await afina.api.sendMessage(
              userId,
              `Последнее, о чем говорили. ${fastSummary}`
            );
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        }

        if (unsummarized.length === messagesCount - 1) {
          const fastSummary = await summaries(unsummarized);

          try {
            await afina.api.sendMessage(
              userId,
              `Последнее, о чем говорили. ${fastSummary}`
            );
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        }

        if (unsummarized.length < messagesCount - 1) {
          const lastSummary = await getLastSummary(chatId);
          const fastSummary = await summaries(unsummarized);

          const response = `Дата и время по UTC: \n${lastSummary[0].date_from} \n${lastSummary[0].date_to} \n${lastSummary[0].text} \n \nПоследнее, о чем говорили. \n${fastSummary}`;

          try {
            await afina.api.sendMessage(userId, response);
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }
        }
      }

      if (messagesCount >= 101 && messagesCount <= 200) {
        const difference = messagesCount - (unsummarized.length + 100);
        const fastSummary = await summaries(unsummarized);
        if (difference <= 0) {
          const lastSummary = await getLastSummary(chatId);

          try {
            await afina.api.sendMessage(
              userId,
              `Дата и время по UTC: \n${lastSummary[0].date_from} \n${lastSummary[0].date_to} \n${lastSummary[0].text} \n \nПоследнее, о чем говорили. \n${fastSummary}`
            );
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        } else {
          const lastSummaries = await getLastSummary(chatId, 2);
          const lastSummariesTexts = lastSummaries
            .map((s) => ({
              text: s.text,
              date_from: s.date_from,
              date_to: s.date_to,
            }))
            .reverse();

          const response = `Дата и время по UTC: \n${lastSummariesTexts[0].date_from} \n${lastSummariesTexts[0].date_to} \n${lastSummariesTexts[0].text} \n \nДата и время по UTC: \n${lastSummariesTexts[1].date_from} \n${lastSummariesTexts[1].date_to} \n${lastSummariesTexts[1].text} \nПоследнее, о чем говорили. \n${fastSummary}
        `;

          try {
            await afina.api.sendMessage(userId, response);
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        }
      }

      if (messagesCount >= 201 && messagesCount <= 300) {
        const difference = messagesCount - (unsummarized.length + 200);
        const fastSummary = await summaries(unsummarized);
        if (difference <= 0) {
          const lastSummaries = await getLastSummary(chatId, 2);
          const lastSummariesTexts = lastSummaries
            .map((s) => ({
              text: s.text,
              date_from: s.date_from,
              date_to: s.date_to,
            }))
            .reverse();

          const response = `Дата и время по UTC: \n${lastSummariesTexts[0].date_from} \n${lastSummariesTexts[0].date_to} \n${lastSummariesTexts[0].text} \n \nДата и время по UTC: \n${lastSummariesTexts[1].date_from} \n${lastSummariesTexts[1].date_to} \n${lastSummariesTexts[1].text} \nПоследнее, о чем говорили. \n${fastSummary}
        `;

          try {
            await afina.api.sendMessage(userId, response);
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        } else {
          const lastSummaries = await getLastSummary(chatId, 3);
          const lastSummariesTexts = lastSummaries
            .map((s) => ({
              text: s.text,
              date_from: s.date_from,
              date_to: s.date_to,
            }))
            .reverse();

          const response = `Дата и время по UTC: \n${lastSummariesTexts[0].date_from} \n${lastSummariesTexts[0].date_to} \n${lastSummariesTexts[0].text} \n \nДата и время по UTC: \n${lastSummariesTexts[1].date_from} \n${lastSummariesTexts[1].date_to} \n${lastSummariesTexts[1].text} \n \nДата и время по UTC: \n${lastSummariesTexts[2].date_from} \n${lastSummariesTexts[2].date_to} \n${lastSummariesTexts[2].text} \nПоследнее, о чем говорили. \n${fastSummary}
        `;

          try {
            await afina.api.sendMessage(userId, response);
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        }
      }

      if (messagesCount >= 301 && messagesCount <= 400) {
        const difference = messagesCount - (unsummarized.length + 300);
        const fastSummary = await summaries(unsummarized);
        if (difference <= 0) {
          const lastSummaries = await getLastSummary(chatId, 3);
          const lastSummariesTexts = lastSummaries
            .map((s) => ({
              text: s.text,
              date_from: s.date_from,
              date_to: s.date_to,
            }))
            .reverse();

          const response = `Дата и время по UTC: \n${lastSummariesTexts[0].date_from} \n${lastSummariesTexts[0].date_to} \n${lastSummariesTexts[0].text} \n \nДата и время по UTC: \n${lastSummariesTexts[1].date_from} \n${lastSummariesTexts[1].date_to} \n${lastSummariesTexts[1].text} \n \nДата и время по UTC: \n${lastSummariesTexts[2].date_from} \n${lastSummariesTexts[2].date_to} \n${lastSummariesTexts[2].text} \nПоследнее, о чем говорили. \n${fastSummary}
        `;
          try {
            await afina.api.sendMessage(userId, response);
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        } else {
          const lastSummaries = await getLastSummary(chatId, 4);
          const lastSummariesTexts = lastSummaries
            .map((s) => ({
              text: s.text,
              date_from: s.date_from,
              date_to: s.date_to,
            }))
            .reverse();

          const response = `Дата и время по UTC: \n${lastSummariesTexts[0].date_from} \n${lastSummariesTexts[0].date_to} \n${lastSummariesTexts[0].text} \n \nДата и время по UTC: \n${lastSummariesTexts[1].date_from} \n${lastSummariesTexts[1].date_to} \n${lastSummariesTexts[1].text} \n \nДата и время по UTC: \n${lastSummariesTexts[2].date_from} \n${lastSummariesTexts[2].date_to} \n${lastSummariesTexts[2].text} \n \n Дата и время по UTC: \n${lastSummariesTexts[3].date_from} \n${lastSummariesTexts[3].date_to} \n${lastSummariesTexts[3].text} \nПоследнее, о чем говорили. \n${fastSummary}
        `;
          try {
            await afina.api.sendMessage(userId, response);
          } catch (e) {
            await afina.api.sendMessage(
              chatId,
              "Похоже я не могу пресказать тебе в лс. Вероятно, мы еще не общались лично. Напиши мне что-нибудь в лс и повтори запрос на пересказ в этом чате. Вот моя ссылочка: https://t.me/Afi_ai_bot",
              { reply_to_message_id: messageId }
            );
          }

          return;
        }
      }

      if (messagesCount >= 401) {
        await afina.api.sendMessage(chatId, "бляя, не... не хочу", { reply_to_message_id: messageId });
      }
    } catch (e) {
      console.error("Reply error:", e);

      await afina.api.sendMessage(
        chatId,
        "Произошла ошибочка при пересказе. Прости😭", 
        { reply_to_message_id: messageId }
      );
    }
  } else {
    const rawMessages = await getRawMessages(chatId, 10);
    const rawMessagesTexts = rawMessages.map(
      (rM) => `${rM.date.substring(5, 16)}:${rM.text}`
    );

    let summariesTexts: string[] = [];

    const config = await decideReplyConfig(nameAndText);

    if (config.contextLevel === "immediate сontext") {
      const extraSummariesTexts = await necesseryContext(chatId);
      summariesTexts = [...summariesTexts, ...extraSummariesTexts];
      await afina.api.sendChatAction(chatId, "typing");
    }

    if (config.contextLevel === "surface chat context") {
      const extraSummariesTexts = await necesseryContext(chatId);
      summariesTexts = [...summariesTexts, ...extraSummariesTexts];

      await afina.api.sendChatAction(chatId, "typing");

      const userEmbedding = await getEmbeddings([nameAndText]);
      const similarEmbeddingsIds = await querySimilar(userEmbedding);
      const similarSummaries = await summariesById(
        similarEmbeddingsIds,
        chatId
      );

      const similarSummariesTexts = similarSummaries.map(
        (sS) => `${sS.date_from}-${sS.date_to}:${sS.text}`
      );

      summariesTexts = [...summariesTexts, ...similarSummariesTexts];
    }

    if (config.contextLevel === "detailed chat context") {
      const extraSummariesTexts = await necesseryContext(chatId); // ok
      summariesTexts = [...summariesTexts, ...extraSummariesTexts];

      await afina.api.sendChatAction(chatId, "typing");

      const userEmbedding = await getEmbeddings([nameAndText]); // ok
      const similarEmbeddingsIds = await querySimilar(userEmbedding); // ok
      const similarSummaries = await summariesById(
        similarEmbeddingsIds,
        chatId
      ); // ok

      const similarSummariesTexts = similarSummaries.map(
        (sS) => `${sS.date_from}-${sS.date_to}:${sS.text}`
      );

      summariesTexts = [...summariesTexts, ...similarSummariesTexts];
    }

    const userResponseDate = new Date(messageDate * 1000)
      .toISOString()
      .substring(5, 16);

    const llmResponse = await composeFinalReply(
      `${userResponseDate}:${nameAndText}`,
      {
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        summariesTexts: summariesTexts,
        rawMessages: rawMessagesTexts,
      }
    );

    console.log({
      message: "✅ Second stage LLM response is success",
      firstStageConfig: {
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        summariesTexts: summariesTexts,
        rawMessages: rawMessagesTexts,
      },
    });

    const afinaMessage = await afina.api.sendMessage(chatId, llmResponse, { reply_to_message_id: messageId });

    if (isTextMessageSchema(afinaMessage)) {
      const parsedAfinaMessage = parseMessage(
        Date.now(),
        afinaMessage,
        [`Afina: ${afinaMessage.text} `],
        "text",
        false
      );

      const recordResult = await saveMessagesRDB(parsedAfinaMessage); // ok
      console.log({
        message: "☑️ Afina message uploaded in relational database",
        record: recordResult,
      });
    }
  }
}
