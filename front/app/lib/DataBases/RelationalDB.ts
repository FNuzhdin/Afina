import {
  SummaryRecordSchema,
  SummarySchema,
  TextMessageRecordSchema,
  TextMessageRecordSchemaArray,
  isSummarySchema,
  isTextMessageRecordSchema,
  isTextMessageRecordSchemaArray,
} from "@/app/utils/Validation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase config error");
}

export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: bigint;
          updateId: bigint;
          messageId: bigint;
          chatId: bigint;
          userId: bigint;
          username: string;
          firstName: string;
          lastName: string;
          text: string;
          date: Date;
          messageType: string;
        };
        Insert: {
          updateId: bigint;
          messageId: bigint;
          chatId: bigint;
          userId: bigint;
          username: string;
          firstName: string;
          lastName: string;
          text: string;
          date: Date;
          messageType: string;
        };
        Update: {
          updateId?: bigint;
          messageId?: bigint;
          chatId?: bigint;
          userId?: bigint;
          username?: string;
          firstName?: string;
          lastName?: string;
          text?: string;
          date?: Date;
          messageType?: string;
        };
      };
    };
  };
}

export const supaClient = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function saveMessagesRDB(
  records: z.infer<typeof TextMessageRecordSchemaArray>
) {
  if (!records.length) {
    throw new Error("No records provided");
  }

  const payload = records.map((record) => ({
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
  }));

  const { data, error } = await supaClient
    .from("messages")
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  if (!isTextMessageRecordSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  return data; // вернёт массив вставленных записей
}

export async function isHundredBatch(chatId: number): Promise<{
  result: boolean;
  unsummarized?: z.infer<typeof TextMessageRecordSchemaArray>;
}> {
  const { data, error } = await supaClient
    .from("messages")
    .select("*")
    .eq("is_summarized", false)
    .eq("chatId", String(chatId));

  if (error) throw error;

  if (!isTextMessageRecordSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  if (data.length < 100) {
    console.log("Not enought messages to summarize. Done.");
    return { result: false };
  }
  return { result: true, unsummarized: data };
}

export async function getUnsummarized(
  chatId: number
): Promise<z.infer<typeof TextMessageRecordSchemaArray>> {
  const { data, error } = await supaClient
    .from("messages")
    .select("*")
    .eq("is_summarized", false)
    .eq("chatId", String(chatId));

  if (error) throw error;

  if (!isTextMessageRecordSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  return data;
}

export async function getLastSummary(
  chat_id: number
): Promise<z.infer<typeof SummarySchema>> {
  const { data, error } = await supaClient
    .from("summaries")
    .select("*")
    .eq("chat_id", String(chat_id))
    .order("created_at", { ascending: false})
    .limit(1);

  if(error) throw error;

  if(!isSummarySchema(data)) {
    throw new Error("Supabase result doesn't match the schema")
  }

  return data;
}

export async function updateStatusSummarized(
  summarized: z.infer<typeof TextMessageRecordSchemaArray>
) {
  const usedIds = summarized.map(
    (msg: z.infer<typeof TextMessageRecordSchema>) => msg.messageId
  );

  await supaClient
    .from("messages")
    .update({ is_summarized: true })
    .in("messageId", usedIds);
}

export async function cleanRDB(chatId: number) {
  const { data: latest10, error: latestError } = await supaClient
    .from("messages")
    .select("*")
    .eq("chatId", String(chatId))
    .order("date", { ascending: false })
    .limit(10);

  if (latestError) throw latestError;

  const latest10Ids = latest10.map(
    (m: z.infer<typeof TextMessageRecordSchema>) => m.messageId
  );

  await supaClient
    .from("message")
    .delete()
    .not("messageId", "in", latest10Ids)
    .eq("chatId", chatId);

  console.log("Deleted old messages, kept latest 10.");
}

export async function saveSummaryRDB(
  summaryPayload: z.infer<typeof SummaryRecordSchema>
): Promise<string> {
  const { data, error } = await supaClient
    .from("summaries")
    .insert([summaryPayload])
    .select();

  if (error) throw error;

  const summaryId: number = data[0].id;

  console.log({
    status: "ok",
    message: "Summary inserted",
    summaryId,
  });

  return String(summaryId);
}

export async function summariesById(
  ids: string[],
  chatId: number
): Promise<z.infer<typeof SummarySchema>[]> {
  const { data, error } = await supaClient
    .from("summaries")
    .select("*")
    .eq("chat_id", String(chatId))
    .in("id", ids);

  if (error) throw error;

  console.log({
    status: "ok",
    message: "Summaries found",
  });

  return data;
}

// функцию, которая будет получать сырые последние сообщения

export async function getRawMessages(
  chatId: number,
  count: number
): Promise<z.infer<typeof TextMessageRecordSchemaArray>> {
  const { data, error } = await supaClient
    .from("messages")
    .select("*")
    .eq("chatId", String(chatId))
    .order("date", { ascending: false })
    .limit(count);

  if (error) throw error;

  if (!data) throw new Error("No data returned from Supabase.");

  if (!isTextMessageRecordSchemaArray(data)) {
    throw new Error("Data has incorrect type");
  }

  return data;
}
