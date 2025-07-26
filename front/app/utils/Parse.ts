import { z } from "zod/v4";
import {
  BaseMessageSchema,
  SummaryToRecordSchema,
  TextMessageToRecordSchema,
  TextMessageReturnRecordSchema,
} from "./Validation";

export function parseMessage(
  update_id: number,
  message: z.infer<typeof BaseMessageSchema>,
  texts: string[],
  messageType: string,
  is_summarized: boolean
): z.infer<typeof TextMessageToRecordSchema>[] {
  const parsedMessages: z.infer<typeof TextMessageToRecordSchema>[] = [];

  for (const text of texts) {
    const parsed = {
      updateId: String(update_id),
      messageId: String(message.message_id),
      chatId: String(message.chat.id),
      userId: String(message.from.id),
      username: message.from.username,
      firstName: message.from.first_name,
      lastName: message.from.last_name,
      text,
      date: new Date(message.date * 1000).toISOString(),
      messageType,
      is_summarized,
    };

    console.log("☑️ Parse: message parsed");

    parsedMessages.push(parsed);
  }

  return parsedMessages;
}

export function parseSummary(
  summarized: z.infer<typeof TextMessageReturnRecordSchema>[],
  summaryText: string
): z.infer<typeof SummaryToRecordSchema> {
  const participantsSet = new Set<string>();

  for (const msg of summarized) {
    if (msg.username) {
      participantsSet.add(msg.username);
    } else if (msg.firstName || msg.lastName) {
      participantsSet.add(
        [msg.firstName, msg.lastName].filter(Boolean).join(" ")
      );
    }
  }

  const participants = Array.from(participantsSet).join(", ");

  const summaryPayload = {
    chat_id: String(summarized[0].chatId),
    participants,
    text: summaryText,
    date_from: summarized[0].date,
    date_to: summarized[summarized.length - 1].date,
    created_at: new Date().toISOString(),
    message_count: summarized.length,
  };

  console.log("☑️ Summary parsed: success");
 
  return summaryPayload;
}
