/**
 * Parses `\`\`\`proposal`-fenced JSON blocks out of a stage-details chat
 * assistant message. Each block is expected to contain a single JSON object
 * matching the server's contract (`services/stage-details-chat.ts`'s
 * `SYSTEM_PROMPT_HEADER`):
 * `{"field": StageDetailFieldId, "lang": string | null, "text": string}`.
 * Malformed JSON, a non-object shape, or an unrecognized `field` value are
 * silently skipped — the surrounding assistant prose still renders normally,
 * only the invalid proposal card is dropped.
 */
import { STAGE_DETAIL_FIELD_IDS, type StageDetailFieldId } from '@zercade-dev/narn-shared';

export interface StageProposal {
  field: StageDetailFieldId;
  lang: string | null;
  text: string;
  /** One short sentence on why this replaces the current text. Optional: a legacy or malformed reply without one still renders as a card. */
  why?: string;
}

const FIELD_ID_SET: ReadonlySet<string> = new Set(STAGE_DETAIL_FIELD_IDS);
const PROPOSAL_FENCE_RE = /```proposal\n([\s\S]*?)```/g;

function isStageDetailFieldId(value: unknown): value is StageDetailFieldId {
  return typeof value === 'string' && FIELD_ID_SET.has(value);
}

/** Validates the parsed JSON's shape against {@link StageProposal}. */
function toProposal(raw: unknown): StageProposal | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (!isStageDetailFieldId(candidate.field)) return null;
  if (candidate.lang !== null && typeof candidate.lang !== 'string') return null;
  if (typeof candidate.text !== 'string') return null;
  if (candidate.why !== undefined && typeof candidate.why !== 'string') return null;
  return {
    field: candidate.field,
    lang: candidate.lang,
    text: candidate.text,
    ...(typeof candidate.why === 'string' ? { why: candidate.why } : {}),
  };
}

/**
 * Extracts every valid `proposal` fence from `markdown`, in order. A fence
 * whose body fails to `JSON.parse` or doesn't match {@link StageProposal}'s
 * shape is skipped rather than throwing.
 */
export function parseProposals(markdown: string): StageProposal[] {
  const out: StageProposal[] = [];
  for (const match of markdown.matchAll(PROPOSAL_FENCE_RE)) {
    const body = match[1].replace(/\n$/, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    const proposal = toProposal(parsed);
    if (proposal) out.push(proposal);
  }
  return out;
}

/**
 * The prose of an assistant reply with every *valid* `proposal` fence
 * removed. The fences already render as Apply cards, so leaving them in the
 * bubble showed each proposal twice — as prose JSON and as a card.
 *
 * A fence is only removed once its body passes the same `JSON.parse` +
 * {@link toProposal} validation `parseProposals` uses. A fence that fails
 * either check is left untouched in the prose: it stays ugly, but the user
 * can still see raw text and knows something went wrong, rather than the
 * proposal vanishing with no card and no trace (e.g. on model truncation).
 *
 * Reuses {@link PROPOSAL_FENCE_RE}'s shape so an unterminated fence (mid-stream)
 * is left untouched rather than swallowing the rest of the reply.
 */
export function stripProposalFences(markdown: string): string {
  return markdown
    .replace(new RegExp(PROPOSAL_FENCE_RE.source, 'g'), (match, rawBody: string) => {
      const body = rawBody.replace(/\n$/, '');
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return match;
      }
      return toProposal(parsed) ? '' : match;
    })
    .trim();
}
