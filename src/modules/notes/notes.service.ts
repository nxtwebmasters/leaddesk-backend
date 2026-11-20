import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma';
import { CreateNoteInput, UpdateNoteInput, NoteFilters } from './notes.types';

export class NotesService {
  private static async getOrCreateTagIds(tagNames: string[]): Promise<string[]> {
    const cleanedNames = Array.from(
      new Set(
        tagNames
          .map((t) => t.trim().toLowerCase())
          .filter((t) => t.length > 0)
      )
    );

    if (cleanedNames.length === 0) {
      return [];
    }

    const tagIds: string[] = [];
    for (const name of cleanedNames) {
      const tag = await prisma.tag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      tagIds.push(tag.id);
    }

    return tagIds;
  }

  public static async findNotes(userId: string, filters: NoteFilters) {
    const where: Prisma.NoteWhereInput = {
      userId,
    };

    if (filters.isPinned !== undefined) {
      where.isPinned = filters.isPinned;
    }

    if (filters.tag) {
      where.tags = {
        some: {
          tag: {
            name: filters.tag.trim().toLowerCase(),
          },
        },
      };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [total, rawItems] = await Promise.all([
      prisma.note.count({ where }),
      prisma.note.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        skip: filters.offset,
        take: filters.limit,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
    ]);

    const items = rawItems.map((note) => ({
      ...note,
      tags: note.tags.map((nt) => nt.tag.name),
    }));

    return {
      total,
      limit: filters.limit,
      offset: filters.offset,
      items,
    };
  }

  public static async getNoteById(userId: string, noteId: string) {
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!note) {
      return null;
    }

    return {
      ...note,
      tags: note.tags.map((nt) => nt.tag.name),
    };
  }

  public static async createNote(userId: string, data: CreateNoteInput) {
    const tagIds = await this.getOrCreateTagIds(data.tags || []);

    const note = await prisma.note.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        isPinned: data.isPinned || false,
        sourceUrl: data.sourceUrl || null,
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return {
      ...note,
      tags: note.tags.map((nt) => nt.tag.name),
    };
  }

  public static async updateNote(userId: string, noteId: string, data: UpdateNoteInput) {
    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!existing) {
      return null;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (data.tags !== undefined) {
        // Delete current tags
        await tx.noteTag.deleteMany({
          where: { noteId },
        });

        // Resolve tag IDs
        const tagIds = await this.getOrCreateTagIds(data.tags);

        // Reconnect tags
        for (const tagId of tagIds) {
          await tx.noteTag.create({
            data: {
              noteId,
              tagId,
            },
          });
        }
      }

      const updated = await tx.note.update({
        where: { id: noteId },
        data: {
          title: data.title ?? undefined,
          content: data.content ?? undefined,
          isPinned: data.isPinned !== undefined ? data.isPinned : undefined,
          sourceUrl: data.sourceUrl !== undefined ? (data.sourceUrl || null) : undefined,
        },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      });

      return updated;
    });

    return {
      ...result,
      tags: result.tags.map((nt) => nt.tag.name),
    };
  }

  public static async deleteNote(userId: string, noteId: string) {
    const existing = await prisma.note.findFirst({
      where: { id: noteId, userId },
    });

    if (!existing) {
      return false;
    }

    await prisma.note.delete({
      where: { id: noteId },
    });

    return true;
  }

  public static async getTags(userId: string) {
    // Return all tags associated with user's notes and their frequency
    const tags = await prisma.tag.findMany({
      where: {
        notes: {
          some: {
            note: {
              userId,
            },
          },
        },
      },
      include: {
        _count: {
          select: {
            notes: {
              where: {
                note: { userId },
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return tags.map((t) => ({
      name: t.name,
      count: t._count.notes,
    }));
  }
}
