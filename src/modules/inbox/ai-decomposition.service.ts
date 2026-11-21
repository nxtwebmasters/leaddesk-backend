import { env } from '../../config/env';
import {
  DecompositionResult,
  ExtractedTaskCandidate,
  ExtractedFollowUpCandidate,
  ExtractedDecisionCandidate,
  ExtractedNoteCandidate,
} from './inbox.types';

export class AiDecompositionService {
  /**
   * Main entrypoint: decomposes raw unstructured text into structured candidate entities.
   * Uses Gemini API if GEMINI_API_KEY is present; otherwise falls back gracefully to
   * the local intelligent heuristic NLP rules engine.
   */
  public static async decompose(
    rawText: string,
    userTimezone: string = 'Asia/Karachi'
  ): Promise<DecompositionResult> {
    const cleanedText = rawText.trim();
    if (!cleanedText) {
      return {
        summary: 'No content to decompose.',
        tasks: [],
        followUps: [],
        decisions: [],
        notes: [],
      };
    }

    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 10) {
      try {
        const aiResult = await this.decomposeWithGemini(cleanedText, userTimezone);
        if (aiResult) {
          return aiResult;
        }
      } catch (err: any) {
        console.warn('Gemini API decomposition failed, falling back to local heuristic engine:', err.message || err);
      }
    }

    // Local heuristic NLP extraction
    return this.decomposeWithLocalHeuristics(cleanedText);
  }

  /**
   * Calls Google Gemini REST API using native fetch.
   */
  private static async decomposeWithGemini(
    text: string,
    timezone: string
  ): Promise<DecompositionResult | null> {
    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];
    const currentDayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    const systemPrompt = `You are an elite Engineering Executive Assistant for a Software Engineering Team Lead.
Current Date: ${currentDateStr} (${currentDayOfWeek}), Timezone: ${timezone}.

Analyze the user's raw input (composite thoughts, stream of consciousness, or transcribed meeting notes) and decompose it into distinct structured candidate objects.

Extract:
1. "tasks": Actionable work. Assign priority ('LOW', 'MEDIUM', 'HIGH', 'URGENT'). Set type to 'DELEGATED' if assigned to a team member (and extract assigneeName), otherwise 'TASK'. Calculate dueAt as ISO-8601 string if relative dates are mentioned (e.g. "by Friday", "tomorrow").
2. "followUps": Any people dependencies, check-ins, or deliverables expected from someone. Extract contactName, subject, nextFollowUpAt (ISO-8601), and expectedOutcome.
3. "decisions": Explicit choices, architecture decisions, or agreements made (e.g. "agreed to use Redis for session caching").
4. "notes": Reference knowledge, observations, or architecture documentation with appropriate tags.

Respond with strict valid JSON containing this exact shape:
{
  "summary": "Short executive summary of what was extracted",
  "tasks": [
    {
      "title": "string",
      "description": "string or null",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "type": "TASK" | "DELEGATED" | "PERSONAL",
      "assigneeName": "string or null",
      "dueAt": "ISO-8601 string or null"
    }
  ],
  "followUps": [
    {
      "contactName": "string",
      "subject": "string",
      "context": "string or null",
      "nextFollowUpAt": "ISO-8601 string",
      "expectedOutcome": "string or null"
    }
  ],
  "decisions": [
    {
      "title": "string",
      "description": "string or null",
      "decidedAt": "ISO-8601 string or null"
    }
  ],
  "notes": [
    {
      "title": "string",
      "content": "string",
      "tags": ["string"]
    }
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemPrompt}\n\nUser Input to Decompose:\n"""\n${text}\n"""` },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) return null;

      const parsed: DecompositionResult = JSON.parse(rawJson);
      return {
        summary: parsed.summary || 'Decomposition completed via Gemini AI.',
        tasks: parsed.tasks || [],
        followUps: parsed.followUps || [],
        decisions: parsed.decisions || [],
        notes: parsed.notes || [],
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * High-accuracy Local Heuristic NLP Rules Engine.
   * Runs reliably without external network or API keys.
   */
  public static decomposeWithLocalHeuristics(text: string): DecompositionResult {
    const tasks: ExtractedTaskCandidate[] = [];
    const followUps: ExtractedFollowUpCandidate[] = [];
    const decisions: ExtractedDecisionCandidate[] = [];
    const notes: ExtractedNoteCandidate[] = [];

    // Split text by lines and major sentence junctions
    const rawChunks = text
      .split(/\n+|(?<=[.!?])\s+|(?<=[;,])\s*(?:and\s+also|and\s+then|also|and)\s+/i)
      .map((c) => c.trim())
      .filter((c) => c.length > 2);

    for (const chunk of rawChunks) {
      const lower = chunk.toLowerCase();

      // 1. Check for Explicit Decisions
      // e.g. "we agreed to use Redis for caching", "decided to migrate to Postgres", "consensus: use JWT"
      if (
        /agreed\s+(?:to|that)|decided\s+(?:to|that)|decision:|consensus\s+is|chose\s+to|settled\s+on/i.test(
          chunk
        )
      ) {
        const title = chunk
          .replace(/^(we\s+agreed\s+to|agreed\s+to|we\s+decided\s+to|decided\s+to|decision:)\s*/i, '')
          .trim();
        decisions.push({
          title: this.capitalize(title),
          description: `Extracted from capture: "${chunk}"`,
          decidedAt: new Date().toISOString(),
        });
        continue;
      }

      // 2. Check for Stakeholder Follow-Ups
      // e.g. "remind Sheraz about Lambda benchmarks by Friday", "follow up with Alex regarding PR"
      const followUpMatch = chunk.match(
        /(?:remind|follow\s*up\s+with|check\s+(?:in\s+)?with|ping|waiting\s+(?:on|for))\s+([A-Z][a-z]+|@\w+|DevOps|QA)\s+(?:about|regarding|on|for)?\s*(.*)/i
      );

      if (followUpMatch) {
        const contact = followUpMatch[1].replace('@', '').trim();
        const rest = followUpMatch[2]?.trim() || 'Check status and progress';
        const nextDate = this.inferDateFromText(chunk) || this.getDateInDays(2);

        followUps.push({
          contactName: this.capitalize(contact),
          subject: this.capitalize(rest.replace(/\s+by\s+[a-z0-9]+$/i, '')),
          context: chunk,
          nextFollowUpAt: nextDate.toISOString(),
          expectedOutcome: 'Resolution and status confirmation',
        });
        continue;
      }

      // 3. Check for Actionable Tasks & Delegation
      // e.g. "Discuss Aurora cluster failover with DevOps on Thursday at 2pm", "Fix login race condition"
      const isTaskKeyword = /^(?:discuss|deploy|fix|implement|prepare|review|write|setup|configure|refactor|test|schedule|create|audit|update|sync)\b/i.test(
        chunk
      ) || /task:\s*/i.test(chunk);

      if (isTaskKeyword || lower.includes('todo') || lower.includes('must') || lower.includes('need to')) {
        let taskTitle = chunk.replace(/^task:\s*/i, '').trim();

        // Check if delegated
        const delegateMatch = chunk.match(/(?:with|assign\s+to|delegate\s+to|tell)\s+([A-Z][a-z]+|DevOps|QA|Backend|Frontend)/i);
        const assignee = delegateMatch ? delegateMatch[1].trim() : null;

        // Check priority
        let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM';
        if (/urgent|asap|p0|blocker|critical/i.test(lower)) {
          priority = 'URGENT';
        } else if (/high|important|p1/i.test(lower)) {
          priority = 'HIGH';
        } else if (/low|minor|p3/i.test(lower)) {
          priority = 'LOW';
        }

        const dueDate = this.inferDateFromText(chunk);

        tasks.push({
          title: this.capitalize(taskTitle),
          description: `Captured from raw note:\n${chunk}`,
          priority,
          type: assignee ? 'DELEGATED' : 'TASK',
          assigneeName: assignee ? this.capitalize(assignee) : null,
          dueAt: dueDate ? dueDate.toISOString() : null,
        });
        continue;
      }

      // 4. Default: Knowledge Note / Architectural Observation
      // e.g. "Note: remember that Aurora reader instances scale up after 70% CPU usage"
      const tags: string[] = [];
      const hashtagMatches = chunk.match(/#(\w+)/g);
      if (hashtagMatches) {
        tags.push(...hashtagMatches.map((t) => t.replace('#', '').toLowerCase()));
      }

      if (/database|aurora|postgres|sql|redis/i.test(lower)) tags.push('database');
      if (/architecture|design|pattern/i.test(lower)) tags.push('architecture');
      if (/devops|docker|k8s|kubernetes|infra/i.test(lower)) tags.push('devops');
      if (/api|backend|node/i.test(lower)) tags.push('backend');

      const noteTitle = chunk.length > 50 ? chunk.substring(0, 47) + '...' : chunk;
      notes.push({
        title: this.capitalize(noteTitle.replace(/^note:\s*/i, '')),
        content: chunk,
        tags: Array.from(new Set(tags)),
      });
    }

    // Safety fallback: if nothing was categorized, create a task
    if (tasks.length === 0 && followUps.length === 0 && decisions.length === 0 && notes.length === 0) {
      tasks.push({
        title: this.capitalize(text.length > 60 ? text.substring(0, 57) + '...' : text),
        description: text,
        priority: 'MEDIUM',
        type: 'TASK',
      });
    }

    const totalCount = tasks.length + followUps.length + decisions.length + notes.length;
    const summary = `Decomposed into ${tasks.length} task(s), ${followUps.length} follow-up(s), ${decisions.length} decision(s), and ${notes.length} note(s).`;

    return {
      summary,
      tasks,
      followUps,
      decisions,
      notes,
    };
  }

  // ----------------------------------------------------
  // Helper Utilities
  // ----------------------------------------------------

  private static inferDateFromText(text: string): Date | null {
    const lower = text.toLowerCase();
    const now = new Date();

    if (lower.includes('today')) {
      const d = new Date(now);
      d.setHours(18, 0, 0, 0);
      return d;
    }

    if (lower.includes('tomorrow')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
      return d;
    }

    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < weekdays.length; i++) {
      if (lower.includes(weekdays[i])) {
        const d = new Date(now);
        const currentDay = d.getDay();
        let diff = i - currentDay;
        if (diff <= 0) diff += 7; // Next occurrence
        d.setDate(d.getDate() + diff);

        // Check if specific time mentioned, e.g. "at 2pm" or "at 14:00"
        const timeMatch = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          const ampm = timeMatch[3]?.toLowerCase();
          if (ampm === 'pm' && hours < 12) hours += 12;
          if (ampm === 'am' && hours === 12) hours = 0;
          d.setHours(hours, minutes, 0, 0);
        } else {
          d.setHours(17, 0, 0, 0);
        }
        return d;
      }
    }

    if (lower.includes('next week')) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      d.setHours(17, 0, 0, 0);
      return d;
    }

    return null;
  }

  private static getDateInDays(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0);
    return d;
  }

  private static capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
