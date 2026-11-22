import { prisma } from '../../common/prisma';
import { IndexDocumentInput, VectorSearchResult } from './ai-decision.types';

export class VectorMemoryService {
  private static readonly EMBEDDING_DIM = 64;

  /**
   * Deterministic high-dimensional vector embedding generator.
   * Produces a normalized 64-dimensional dense semantic vector from text.
   */
  public static generateEmbedding(text: string): number[] {
    const vector = new Array(this.EMBEDDING_DIM).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter((t) => t.length > 1);

    if (tokens.length === 0) {
      vector[0] = 1.0;
      return vector;
    }

    // 1. Term and character n-gram distribution across dimensional buckets
    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.EMBEDDING_DIM;
      const weight = Math.log(1 + token.length);
      vector[idx] += weight;

      // Bigram projection
      if (token.length >= 3) {
        for (let i = 0; i < token.length - 1; i++) {
          const biHash = (token.charCodeAt(i) * 31 + token.charCodeAt(i + 1)) % this.EMBEDDING_DIM;
          vector[biHash] += 0.5;
        }
      }
    }

    // 2. Semantic feature boosting for architecture & technical engineering concepts
    const semanticKeywords: Record<string, number[]> = {
      database: [1, 5, 9, 13],
      postgres: [1, 5, 9, 14],
      architecture: [2, 6, 10, 15],
      decision: [2, 6, 11, 16],
      incident: [3, 7, 12, 17],
      outage: [3, 7, 12, 18],
      auth: [4, 8, 19, 23],
      security: [4, 8, 20, 24],
      dora: [25, 29, 33, 37],
      deploy: [25, 29, 34, 38],
      performance: [26, 30, 35, 39],
      latency: [26, 30, 36, 40],
      okr: [41, 45, 49, 53],
      goal: [41, 45, 50, 54],
      devex: [55, 59, 61, 63],
      sprint: [56, 60, 62, 63],
    };

    for (const [kw, dims] of Object.entries(semanticKeywords)) {
      if (cleaned.includes(kw)) {
        for (const d of dims) {
          vector[d] += 2.5;
        }
      }
    }

    // 3. L2 Normalization so dot product equals cosine similarity
    let sumSquares = 0;
    for (let i = 0; i < this.EMBEDDING_DIM; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSquares) || 1.0;
    for (let i = 0; i < this.EMBEDDING_DIM; i++) {
      vector[i] = parseFloat((vector[i] / magnitude).toFixed(6));
    }

    return vector;
  }

  /**
   * Calculate Cosine Similarity between two normalized vectors
   */
  public static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }
    return Math.max(0, Math.min(1.0, dotProduct));
  }

  /**
   * Index document or decision into Semantic Vector Memory
   */
  public static async indexDocument(orgId: string, input: IndexDocumentInput) {
    const textToEmbed = `${input.title}\n${input.content}`;
    const embedding = this.generateEmbedding(textToEmbed);

    return prisma.semanticMemory.create({
      data: {
        orgId,
        entityType: input.entityType,
        entityId: input.entityId || null,
        title: input.title,
        content: input.content,
        embedding,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  /**
   * Search vector memory using semantic cosine similarity
   */
  public static async search(
    orgId: string,
    query: string,
    limit = 5,
    minSimilarity = 0.15,
    entityType?: string | null
  ): Promise<VectorSearchResult[]> {
    const queryEmbedding = this.generateEmbedding(query);

    const where: any = { orgId };
    if (entityType) where.entityType = entityType;

    const memories = await prisma.semanticMemory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200, // Fetch candidates for in-memory vector ranking
    });

    const scored = memories.map((mem) => {
      const similarity = this.cosineSimilarity(queryEmbedding, mem.embedding);
      return {
        id: mem.id,
        entityType: mem.entityType,
        entityId: mem.entityId,
        title: mem.title,
        content: mem.content,
        similarity: parseFloat(similarity.toFixed(4)),
        metadata: mem.metadata,
        createdAt: mem.createdAt,
      };
    });

    return scored
      .filter((s) => s.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Synchronize existing core database decisions, incidents, and notes into vector memory
   */
  public static async syncCoreEntities(orgId: string): Promise<number> {
    const [decisions, incidents, notes] = await Promise.all([
      prisma.decision.findMany({
        where: {
          user: { orgMemberships: { some: { orgId } } },
        },
        take: 50,
      }),
      prisma.incident.findMany({
        where: { orgId },
        take: 50,
      }),
      prisma.note.findMany({
        where: {
          user: { orgMemberships: { some: { orgId } } },
        },
        take: 50,
      }),
    ]);

    let indexedCount = 0;

    for (const d of decisions) {
      await this.indexDocument(orgId, {
        entityType: 'DECISION',
        entityId: d.id,
        title: d.title,
        content: d.description || d.title,
        metadata: { decidedAt: d.decidedAt },
      });
      indexedCount++;
    }

    for (const inc of incidents) {
      const content = `Incident: ${inc.title}. Service: ${inc.serviceName}. Severity: ${inc.severity}. Status: ${inc.status}. Root Cause: ${inc.rootCause || 'N/A'}. Recovery Time: ${inc.recoveryTimeMinutes || 0} minutes.`;
      await this.indexDocument(orgId, {
        entityType: 'INCIDENT',
        entityId: inc.id,
        title: inc.title,
        content,
        metadata: { serviceName: inc.serviceName, severity: inc.severity },
      });
      indexedCount++;
    }

    for (const n of notes) {
      await this.indexDocument(orgId, {
        entityType: 'NOTE',
        entityId: n.id,
        title: n.title,
        content: n.content,
        metadata: { updatedAt: n.updatedAt },
      });
      indexedCount++;
    }

    return indexedCount;
  }
}
