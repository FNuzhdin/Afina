import { z } from "zod/v4";

export const FromSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.literal(true).optional(),
});

export const ChatSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  type: z.string(),
  all_members_are_administrators: z.boolean().optional(),
      accepted_gift_types: z.object({
        unlimited_gifts: z.boolean(),
        limited_gifts: z.boolean(),
        unique_gifts: z.boolean(),
        premium_subscription: z.boolean()
      }).optional()
});

export const PhotoSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_size: z.number(),
  width: z.number(),
  height: z.number(),
});

export const BaseMessageSchema = z.object({
  message_id: z.number(),
  from: FromSchema,
  chat: ChatSchema,
  date: z.number(),
  reply_to_message: z.object({
    message_id: z.number(),
    from: FromSchema,
    chat: ChatSchema,
    date: z.number(),
    text: z.string().optional()
  }).optional(),
});

export const TextMessageSchema = BaseMessageSchema.extend({
  text: z.string(),
});

export const PhotoMessageSchema = BaseMessageSchema.extend({
  photo: z.array(PhotoSchema),
  caption: z.string().optional(),
});

export const VoiceMesssageSchema = BaseMessageSchema.extend({
  voice: z.object({
    duration: z.number(),
    mime_type: z.string(),
    file_id: z.string(),
    file_unique_id: z.string(),
    file_size: z.number(),
  }),
});

export const VideoNoteMesssageSchema = BaseMessageSchema.extend({
  video_note: z.object({
    duration: z.number(),
    length: z.number(),
    thumb: z
      .object({
        file_id: z.string(),
        file_unique_id: z.string(),
        file_size: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    file_id: z.string(),
    file_unique_id: z.string(),
    file_size: z.number(),
  }),
});

const VideoThumbnailSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_size: z.number().optional(),
  width: z.number(),
  height: z.number(),
});

const VideoSchema = z.object({
  duration: z.number(),
  width: z.number(),
  height: z.number(),
  mime_type: z.string(),
  file_id: z.string(),
  file_unique_id: z.string(),
  file_size: z.number(),
  thumbnail: VideoThumbnailSchema.optional(),
  thumb: VideoThumbnailSchema.optional(),
});

export const VideoMessageSchema = BaseMessageSchema.extend({
  video: VideoSchema,
  caption: z.string().optional(),
});

export const MyChatMemberUpdateSchema = z.object({
  update_id: z.number(),
  my_chat_member: z.object({
    chat: ChatSchema,
    from: FromSchema,
    date: z.number(),
    old_chat_member: z.object({
      user: z.object({
        id: z.number(),
        is_bot: z.boolean(),
        first_name: z.string().optional(),
        username: z.string(),
      }),
      status: z.string(),
    }),
    new_chat_member: z.object({
      user: z.object({
        id: z.number(),
        is_bot: z.boolean(),
        first_name: z.string().optional(),
        username: z.string(),
      }),
      status: z.string(),
    }),
  })
});

// не используется можно убрать 
export const UpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .union([
      BaseMessageSchema,
      TextMessageSchema,
      PhotoMessageSchema,
      VoiceMesssageSchema,
      VideoNoteMesssageSchema,
    ])
    .optional(),
});

export const TelegramFileInfoSchema = z.object({
  ok: z.boolean(),
  result: z.object({
    file_path: z.string(),
  }),
});

export const AssemblyAiUploadUrlSchema = z.object({
  upload_url: z.string(),
});

export const AssemblyAiResponseSchema = z.object({
  id: z.string(),
  audio_url: z.string(),
  status: z.string(),
  text: z.string().nullable(),
});

export const AssemblyAiResponseErrorSchema = z.object({
  status: z.string(),
  error: z.string(),
});

export const EmbeddingResponseSchema = z.array(z.array(z.number()));

export const TextMessageToRecordSchema = z.object({
  updateId: z.string(),
  messageId: z.string(),
  chatId: z.string(),
  userId: z.string(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  text: z.string(),
  date: z.string(),
  messageType: z.string(),
  is_summarized: z.boolean(),
});

export const TextMessageToRecordSchemaArray = z.array(TextMessageToRecordSchema);

export const TextMessageReturnRecordSchema = z.object({
  id: z.number(),
  updateId: z.coerce.number(),
  messageId: z.number(),
  chatId: z.number(),
  userId: z.number(),
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  text: z.string(),
  date: z.string(),
  messageType: z.string(),
  is_summarized: z.boolean(),
}
)

export const TextMessageReturnRecordSchemaArray = z.array(TextMessageReturnRecordSchema);

export const SummaryToRecordSchema = z.object({
  chat_id: z.string(),
  participants: z.string(),
  text: z.string(),
  date_from: z.string(),
  date_to: z.string(),
  created_at: z.string(),
  message_count: z.number(),
}); 

export const SummaryReturnSchema = z.object({
  id: z.coerce.number(),        
  chat_id: z.string(),
  participants: z.string(),
  text: z.string(),
  date_from: z.string(),
  date_to: z.string(),
  created_at: z.string(),
  message_count: z.number(),
});

export const SummaryReturnSchemaArray = z.array(SummaryReturnSchema);

export function isSummaryReturnSchema(
  data: unknown
): data is z.infer<typeof SummaryReturnSchema> {
  return SummaryReturnSchema.safeParse(data).success;
}


export function isSummaryToRecordSchema(
  data: unknown
): data is z.infer<typeof SummaryToRecordSchema> {
  return SummaryToRecordSchema.safeParse(data).success;
}

export function isTextMessageToRecordSchemaArray(
  data: unknown
): data is z.infer<typeof TextMessageToRecordSchemaArray> {
  return TextMessageToRecordSchemaArray.safeParse(data).success;
}


export function isTextMessageToRecordSchema(
  data: unknown
): data is z.infer<typeof TextMessageToRecordSchema> {
  return TextMessageToRecordSchema.safeParse(data).success;
}

export function isTelegramFileInfoSchema(
  data: unknown
): data is z.infer<typeof TelegramFileInfoSchema> {
  return TelegramFileInfoSchema.safeParse(data).success;
}

export function isAssemblyAiUploadUrl(
  data: unknown
): data is z.infer<typeof AssemblyAiUploadUrlSchema> {
  return AssemblyAiUploadUrlSchema.safeParse(data).success;
}

export function isAssemblyAiResponseSchema(
  data: unknown
): data is z.infer<typeof AssemblyAiResponseSchema> {
  return AssemblyAiResponseSchema.safeParse(data).success;
}

export function isAssemblyAiResponseErrorSchema(
  data: unknown
): data is z.infer<typeof AssemblyAiResponseErrorSchema> {
  return AssemblyAiResponseErrorSchema.safeParse(data).success;
}

// не исопльзуется можно убрать 
export function isUpdateSchema(
  data: unknown
): data is z.infer<typeof UpdateSchema> {
  return UpdateSchema.safeParse(data).success;
}

export function isBaseMessageSchema(
  data: unknown
): data is z.infer<typeof BaseMessageSchema> {
  return BaseMessageSchema.safeParse(data).success;
}

export function isPhotoMessageSchema(
  data: unknown
): data is z.infer<typeof PhotoMessageSchema> {
  return PhotoMessageSchema.safeParse(data).success;
}

export function isTextMessageSchema(
  data: unknown
): data is z.infer<typeof TextMessageSchema> {
  return TextMessageSchema.safeParse(data).success;
}

export function isVoiceMesssageSchema(
  data: unknown
): data is z.infer<typeof VoiceMesssageSchema> {
  return VoiceMesssageSchema.safeParse(data).success;
}

export function isVideoNoteMesssageSchema(
  data: unknown
): data is z.infer<typeof VideoNoteMesssageSchema> {
  return VideoNoteMesssageSchema.safeParse(data).success;
}

export function isEmbeddingResponseSchema(
  data: unknown
): data is z.infer<typeof EmbeddingResponseSchema> {
  return EmbeddingResponseSchema.safeParse(data).success;
}

export function isMyChatMemberUpdateSchema(
  data: unknown
): data is z.infer<typeof MyChatMemberUpdateSchema> {
  return MyChatMemberUpdateSchema.safeParse(data).success;
}

export function isTextMessageReturnRecordSchema(
  data: unknown
): data is z.infer<typeof TextMessageReturnRecordSchema> {
  return TextMessageReturnRecordSchema.safeParse(data).success;
}

export function isTextMessageReturnRecordSchemaArray(
  data: unknown
): data is z.infer<typeof TextMessageReturnRecordSchemaArray> {
  return TextMessageReturnRecordSchemaArray.safeParse(data).success;
}

export function isSummaryReturnSchemaArray(
  data: unknown
): data is z.infer<typeof SummaryReturnSchemaArray> {
  return SummaryReturnSchemaArray.safeParse(data).success;
}


export function isVideoMessageSchema(
  data: unknown
): data is z.infer<typeof VideoMessageSchema> {
  return VideoMessageSchema.safeParse(data).success;
}

