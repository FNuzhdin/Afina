import { supaClient } from "./SupaClient";
import { TextMessageRecord } from "../utils/Parse";

export async function saveMessageRDB(record: TextMessageRecord) {
  const { data, error } = await supaClient.from("messages").insert([
    {
      updateId: record.updateId,
      messageId: record.messageId,
      chatId: record.chatId,
      userId: record.userId,
      username: record.username,
      firstName: record.firstName,
      lastName: record.lastName,
      text: record.text,
      date: record.date,
      messageType: record.messageType,
    },
  ]).select();

  if (error) {
    throw error;
  }

  return data;
}