import {
  SummaryToRecordSchema,
  SummaryReturnSchema,
  TextMessageToRecordSchema,
  TextMessageReturnRecordSchema,
  isSummaryReturnSchemaArray,
  isTextMessageReturnRecordSchemaArray,
} from "@/app/utils/Validation";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

export function createSupabaseClient() {
  if (!process.env.SUPABASE_URL) throw new Error();
  return createClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
          is_summarized: boolean;
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
          is_summarized: boolean;
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
          is_summarized?: boolean;
        };
      };

      summaries: {
        Row: {
          id: bigint;
          chat_id: string;
          participants: string;
          text: string;
          date_from: Date;
          date_to: Date;
          created_at: Date;
          message_count: number;
        };
        Insert: {
          chat_id: string;
          participants: string;
          text: string;
          date_from: Date;
          date_to: Date;
          created_at: Date;
          message_count: number;
        };
        Update: {
          chat_id?: string;
          participants?: string;
          text?: string;
          date_from?: Date;
          date_to?: Date;
          created_at?: Date;
          message_count?: number;
        };
      };
    };
  };
}

export const supaClient = createSupabaseClient();

export async function saveMessagesRDB(
  records: z.infer<typeof TextMessageToRecordSchema>[]
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
    is_summarized: record.is_summarized,
  }));

  const { data, error } = await supaClient
    .from("messages")
    .insert(payload)
    .select();

  if (error) {
    throw error;
  }

  if (!isTextMessageReturnRecordSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  return data; // вернёт массив вставленных записей
}

export async function isHundredBatch(chatId: number): Promise<{
  result: boolean;
  unsummarized?: z.infer<typeof TextMessageReturnRecordSchema>[];
}> {
  const { data, error } = await supaClient
    .from("messages")
    .select("*")
    .eq("is_summarized", false)
    .eq("chatId", String(chatId));

  if (error) throw error;

  if (!isTextMessageReturnRecordSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  if (data.length < 100) {
    console.log("✅ Not enought messages to summarize. Done.");
    return { result: false };
  }
  return { result: true, unsummarized: data };
}

// испралено
export async function getUnsummarized(
  chatId: number
): Promise<z.infer<typeof TextMessageReturnRecordSchema>[]> {
  const { data, error } = await supaClient
    .from("messages")
    .select("*")
    .eq("is_summarized", false)
    .eq("chatId", String(chatId))
    .order("date", { ascending: true} );

  if (error) throw error;

  if (!isTextMessageReturnRecordSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  return data;
}

// исправлено
export async function getLastSummary(
  chat_id: number,
  count: number = 1
): Promise<z.infer<typeof SummaryReturnSchema>[]> {
  const { data, error } = await supaClient
    .from("summaries")
    .select("*")
    .eq("chat_id", String(chat_id))
    .order("created_at", { ascending: false })
    .limit(count);

  if (error) throw error;

  console.log(data);
  if (!isSummaryReturnSchemaArray(data)) {
    throw new Error("Supabase result doesn't match the schema");
  }

  return data;
}

export async function getSummaryCount(chat_id: number): Promise<number> {
  const { count, error } = await supaClient
    .from("summaries")
    .select("*", { count: "exact", head: true }) // <- ВАЖНО: head: true не возвращает сами данные
    .eq("chat_id", String(chat_id));

  if (error) throw error;

  return count ?? 0;
}


export async function updateStatusSummarized(
  summarized: z.infer<typeof TextMessageReturnRecordSchema>[]
) {
  const usedIds = summarized.map(
    (msg: z.infer<typeof TextMessageReturnRecordSchema>) => msg.id
  );

  await supaClient
    .from("messages")
    .update({ is_summarized: true })
    .in("id", usedIds);
}

export async function cleanRDB(chatId: number) {
  const { data: latest10, error: latestError } = await supaClient
    .from("messages")
    .select("*")
    .eq("chatId", chatId)
    .order("date", { ascending: false })
    .limit(10);

  if (latestError) throw latestError;

  const latest10Ids = latest10.map(
    (m: z.infer<typeof TextMessageReturnRecordSchema>) => m.id
  );

  if (latest10Ids.length === 0) {
    console.log("⚠️ No messages found to preserve. Skipping deletion.");
    return;
  }

  const { error: deleteError } = await supaClient
    .from("messages")
    .delete()
    .not("id", "in", `(${latest10Ids.join(",")})`)
    .eq("chatId", String(chatId));

  if (deleteError) {
    console.error("❌ Delete error:", deleteError);
  }

  console.log("☑️ Deleted old messages, kept latest 10.");
}

export async function saveSummaryRDB(
  summaryPayload: z.infer<typeof SummaryToRecordSchema>
): Promise<string> {
  const { data, error } = await supaClient
    .from("summaries")
    .insert([summaryPayload])
    .select();

  if (error) throw error;

  const summaryId: number = data[0].id;

  console.log("☑️ Save summary: summary inserted");

  return String(summaryId);
}

export async function summariesById(
  ids: string[],
  chatId: number
): Promise<z.infer<typeof SummaryReturnSchema>[]> {
  const { data, error } = await supaClient
    .from("summaries")
    .select("*")
    .eq("chat_id", String(chatId))
    .in("id", ids);

  if (error) throw error;

  console.log("☑️ Summaries by id: found");

  if (!isSummaryReturnSchemaArray(data)) {
    throw new Error("Data doesn't match SummaryReturnSchemaArray");
  }

  return data;
}

// функция, которая будет получать сырые последние сообщения
export async function getRawMessages(
  chatId: number,
  count: number
): Promise<z.infer<typeof TextMessageReturnRecordSchema>[]> {
  const { data, error } = await supaClient
    .from("messages")
    .select("*")
    .eq("chatId", String(chatId))
    .order("date", { ascending: false })
    .limit(count);

  if (error) throw error;

  if (!data) throw new Error("No data returned from Supabase.");

  if (!isTextMessageReturnRecordSchemaArray(data)) {
    throw new Error("Data has incorrect type");
  }

  return data;
}
