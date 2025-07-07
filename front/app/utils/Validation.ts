import { z } from "zod/v4";

const FromSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.literal(true).optional(),
});

const ChatSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string(),
  type: z.string(),
});

const PhotoSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  file_size: z.number(),
  width: z.number(),
  height: z.number(),
});

const BaseMessageSchema = z.object({
  message_id: z.number(),
  from: FromSchema,
  chat: ChatSchema,
  date: z.number(),
});

// This schema is only for text messages from users
export const TextMessageSchema = BaseMessageSchema.extend({
  text: z.string(),
});

// This schema is only for photo messages from users
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

export const MyChatMemberUpdateSchema = z.object({
  update_id: z.number(),
  my_chat_member: z.object({
    chat: z.object({
      id: z.number(),
      title: z.string(), 
      type: z.literal("group"),
      all_members_are_administrators: z.boolean().optional(),
      accepted_gift_types: z.object({
        unlimited_gifts: z.boolean(),
        limited_gifts: z.boolean(),
        unique_gifts: z.boolean(),
        premium_subscription: z.boolean()
      }).optional()
    }),
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

// можно стереть, если не буду использовать
export const WhisperResponseSchema = z.object({
  text: z.string(),
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

// возможно лишнее, нигде не используется
export const RecordResultSchema = z.array(
  z.object({
    id: z.number(),
    updateId: z.number(),
    messageId: z.number(),
    chatId: z.number(),
    userId: z.number(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    text: z.string(),
    date: z.string(),
    messageType: z.string(),
  })
);

export const EmbeddingResponseSchema = z.array(z.array(z.number()));

export function isTelegramFileInfoSchema(
  data: unknown
): data is z.infer<typeof TelegramFileInfoSchema> {
  return TelegramFileInfoSchema.safeParse(data).success;
}

// можно стереть, если не буду использовать
export function isWhisperResponseSchema(
  data: unknown
): data is z.infer<typeof WhisperResponseSchema> {
  return WhisperResponseSchema.safeParse(data).success;
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

// возможно лишнее нигде не используется
export function isRecordResultSchema(
  data: unknown
): data is z.infer<typeof RecordResultSchema> {
  return RecordResultSchema.safeParse(data).success;
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