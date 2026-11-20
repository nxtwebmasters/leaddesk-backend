import { z } from 'zod';

export interface AttachmentDto {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
  userId: string;
  taskId?: string | null;
  noteId?: string | null;
  meetingId?: string | null;
  downloadUrl: string;
  viewUrl: string;
}

export const AttachmentQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  noteId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
});

export type AttachmentQuery = z.infer<typeof AttachmentQuerySchema>;

export const UploadAttachmentBodySchema = z.object({
  taskId: z.string().uuid().optional(),
  noteId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
});

export type UploadAttachmentBody = z.infer<typeof UploadAttachmentBodySchema>;
