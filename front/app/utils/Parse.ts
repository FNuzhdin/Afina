import { z } from "zod/v4";
import { TextMessageSchema } from "./Validation";

export type TextMessageRecord = {
  updateId: string;
  messageId: string;
  chatId: string;
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  text: string;
  date: string;
  messageType: string;
};

export function parseMessage(
  update_id: number,
  message: z.infer<typeof TextMessageSchema>, 
  messageType: string,
): TextMessageRecord {
  return {
    updateId: String(update_id),
    messageId: String(message.message_id),
    chatId: String(message.chat.id),
    userId: String(message.from.id),
    username: message.from.username,
    firstName: message.from.first_name,
    lastName: message.from.last_name,
    text: message.text,
    date: new Date(message.date * 1000).toISOString(),
    messageType
  };
}