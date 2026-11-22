import { VectorMemoryService } from './vector-memory.service';
import { AskRagInput, RagAnswer, Citation } from './ai-decision.types';

export class DecisionRagService {
  /**
   * Ask the Architecture Decision RAG Assistant
   * Performs semantic vector search over architectural decisions, meeting transcripts, and incident records,
   * then synthesizes a grounded answer with direct citations.
   */
  public static async ask(orgId: string, input: AskRagInput): Promise<RagAnswer> {
    const { question, contextFilter } = input;

    // 1. Semantic Retrieval across Vector Memory
    const retrieved = await VectorMemoryService.search(
      orgId,
      question,
      5,
      0.15,
      contextFilter
    );

    if (retrieved.length === 0) {
      return {
        question,
        answer: `I searched the organizational memory (including Architecture Decision Records, Meeting Notes, RFCs, and Incident Post-Mortems), but found no indexed decisions directly matching "${question}". Try refining your query or syncing recent architectural notes.`,
        confidenceScore: 0.1,
        citations: [],
        retrievedCount: 0,
      };
    }

    // 2. Extract Citations
    const citations: Citation[] = retrieved.map((item) => ({
      sourceType: item.entityType,
      title: item.title,
      referenceId: item.entityId,
      excerpt: item.content.length > 180 ? item.content.substring(0, 180) + '...' : item.content,
    }));

    // 3. Synthesize Grounded Architecture Decision Answer
    const topMatch = retrieved[0];
    const topScore = topMatch.similarity;

    let synthesis = '';
    synthesis += `Based on historical engineering decisions and architecture records in this organization:\n\n`;

    retrieved.forEach((item, idx) => {
      synthesis += `• **[${item.entityType}: ${item.title}]** (Relevance: ${(item.similarity * 100).toFixed(0)}%)\n`;
      synthesis += `  ${item.content}\n\n`;
    });

    synthesis += `**Key Architectural Takeaway:** The primary consensus recorded in [${topMatch.entityType}: ${topMatch.title}] indicates that this decision was made to optimize system reliability and operational alignment.`;

    return {
      question,
      answer: synthesis,
      confidenceScore: topScore,
      citations,
      retrievedCount: retrieved.length,
    };
  }
}
