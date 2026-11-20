import { prisma } from '../../common/prisma';
import { getStorageProvider } from './storage';
import { AttachmentDto, AttachmentQuery } from './attachments.types';

export class AttachmentsService {
  private static storage = getStorageProvider();

  public static async createAttachment(
    userId: string,
    file: Express.Multer.File,
    entityLinks: { taskId?: string; noteId?: string; meetingId?: string }
  ): Promise<AttachmentDto> {
    const { taskId, noteId, meetingId } = entityLinks;

    // Validate ownership of linked entities
    if (taskId) {
      const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
      if (!task) {
        throw new Error('Linked Task not found or not owned by user');
      }
    }

    if (noteId) {
      const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
      if (!note) {
        throw new Error('Linked Note not found or not owned by user');
      }
    }

    if (meetingId) {
      const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, userId } });
      if (!meeting) {
        throw new Error('Linked Meeting not found or not owned by user');
      }
    }

    let prefix = 'general';
    if (taskId) prefix = 'tasks';
    else if (noteId) prefix = 'notes';
    else if (meetingId) prefix = 'meetings';

    const saveResult = await this.storage.save(file, prefix);

    const record = await prisma.attachment.create({
      data: {
        fileName: file.originalname || 'attachment',
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: BigInt(saveResult.sizeBytes),
        storageKey: saveResult.storageKey,
        userId,
        taskId: taskId || null,
        noteId: noteId || null,
        meetingId: meetingId || null,
      },
    });

    return this.mapToDto(record);
  }

  public static async getAttachments(userId: string, query: AttachmentQuery): Promise<AttachmentDto[]> {
    const where: any = { userId };
    if (query.taskId) where.taskId = query.taskId;
    if (query.noteId) where.noteId = query.noteId;
    if (query.meetingId) where.meetingId = query.meetingId;

    const list = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return list.map((a) => this.mapToDto(a));
  }

  public static async getAttachmentById(userId: string, attachmentId: string): Promise<AttachmentDto> {
    const record = await prisma.attachment.findFirst({
      where: { id: attachmentId, userId },
    });

    if (!record) {
      throw new Error('Attachment not found');
    }

    return this.mapToDto(record);
  }

  public static async getAttachmentStream(userId: string, attachmentId: string) {
    const record = await prisma.attachment.findFirst({
      where: { id: attachmentId, userId },
    });

    if (!record) {
      throw new Error('Attachment not found');
    }

    const streamResult = await this.storage.getStream(record.storageKey);
    return {
      stream: streamResult.stream,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: Number(record.sizeBytes),
    };
  }

  public static async deleteAttachment(userId: string, attachmentId: string): Promise<void> {
    const record = await prisma.attachment.findFirst({
      where: { id: attachmentId, userId },
    });

    if (!record) {
      throw new Error('Attachment not found');
    }

    // Delete file from physical storage
    try {
      await this.storage.delete(record.storageKey);
    } catch (err) {
      console.warn(`Warning: Could not remove file from storage for attachment ${attachmentId}:`, err);
    }

    // Delete database record
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });
  }

  private static mapToDto(record: any): AttachmentDto {
    return {
      id: record.id,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: Number(record.sizeBytes),
      storageKey: record.storageKey,
      createdAt: record.createdAt,
      userId: record.userId,
      taskId: record.taskId,
      noteId: record.noteId,
      meetingId: record.meetingId,
      downloadUrl: `/api/v1/attachments/${record.id}/download`,
      viewUrl: `/api/v1/attachments/${record.id}/view`,
    };
  }
}
