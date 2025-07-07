import { z } from "zod/v4";

const FromSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string(),
  username: z.string(),
  language_code: z.string(),
  is_premium: z.boolean(),
});

const ChatSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
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

export const UpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .union([
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

export const WhisperResponseSchema = z.object({
  text: z.string(),
});

export const AssemblyAiUploadUrlSchema = z.object({
  upload_url: z.string()
})

export const AssemblyAiResponseSchema = z.object({
  id: z.string(),
  audio_url: z.string(),
  status: z.string(),
  text: z.string().nullable(),
})

export const AssemblyAiResponseErrorSchema = z.object({
  status: z.string(),
  error: z.string()
})

export function isTelegramFileInfoSchema(
  data: unknown
): data is z.infer<typeof TelegramFileInfoSchema> {
  return TelegramFileInfoSchema.safeParse(data).success;
}

export function isWhisperResponseSchema(data: unknown): data is z.infer<typeof WhisperResponseSchema> {
  return WhisperResponseSchema.safeParse(data).success;
}

export function isAssemblyAiUploadUrl(data: unknown): data is z.infer<typeof AssemblyAiUploadUrlSchema> {
  return AssemblyAiUploadUrlSchema.safeParse(data).success;
}

export function isAssemblyAiResponseSchema(data: unknown): data is z.infer<typeof AssemblyAiResponseSchema> {
  return AssemblyAiResponseSchema.safeParse(data).success;
}

export function isAssemblyAiResponseErrorSchema(data: unknown): data is z.infer<typeof AssemblyAiResponseErrorSchema> {
  return AssemblyAiResponseErrorSchema.safeParse(data).success;
}

export function isUpdateSchema(
  data: unknown
): data is z.infer<typeof UpdateSchema> {
  return UpdateSchema.safeParse(data).success;
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
