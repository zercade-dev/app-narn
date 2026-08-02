/**
 * Parses the Text Styler assistant's suggestion fences out of an assistant
 * message. The server prompt asks for a ```styled fence holding one JSON
 * object matching {@link StyledProposal}; any OTHER fence is treated as a
 * legacy untyped suggestion (`{ text }` with no reason), which is what the
 * pre-2026-07-30 prompt produced and what a drifting model still emits.
 *
 * A ```styled fence whose body fails to parse or does not match the shape is
 * deliberately NOT demoted to the legacy path — doing so would put a raw
 * `{"text": …}` JSON blob into the user's editor on Apply. It yields no card and
 * is left visible in the prose instead: ugly but visible beats silently gone
 * (the same failure mode `lib/stage-proposals.ts` documents).
 */

export interface StyledProposal {
  /** The full rewritten string, with markup tags, ready to replace the draft. */
  text: string;
  /** One short sentence on why. Absent for a legacy (untyped) fence. */
  why?: string;
}

/** Every fenced block: group 1 is the info string, group 2 the body. */
const FENCE_RE = /```([^\n]*)\n([\s\S]*?)```/g;

/** Validates a parsed ```styled body against {@link StyledProposal}. */
function toProposal(raw: unknown): StyledProposal | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.text !== 'string') return null;
  if (candidate.why !== undefined && typeof candidate.why !== 'string') return null;
  return {
    text: candidate.text,
    ...(typeof candidate.why === 'string' ? { why: candidate.why } : {}),
  };
}

/**
 * One fence → a proposal, or `null` when it is not a usable suggestion and must
 * stay in the prose. A blank `text` is rejected on both paths: applying it would
 * wipe the user's draft, which is never what an empty fence meant.
 */
function fenceToProposal(info: string, rawBody: string): StyledProposal | null {
  const body = rawBody.replace(/\n$/, '');
  let proposal: StyledProposal | null;
  if (info.trim() === 'styled') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
    proposal = toProposal(parsed);
  } else {
    proposal = { text: body };
  }
  return proposal && proposal.text.trim() ? proposal : null;
}

/** Every usable suggestion in `markdown`, in the order the model emitted them. */
export function parseStyledProposals(markdown: string): StyledProposal[] {
  const out: StyledProposal[] = [];
  for (const match of markdown.matchAll(new RegExp(FENCE_RE.source, 'g'))) {
    const proposal = fenceToProposal(match[1], match[2]);
    if (proposal) out.push(proposal);
  }
  return out;
}

/**
 * The prose of an assistant reply with every fence that became a card removed —
 * leaving them in showed each suggestion twice. A fence that yielded no card is
 * left untouched, as is an unterminated one (mid-stream), so a partial reply
 * never swallows the rest of the bubble.
 */
export function stripStyledFences(markdown: string): string {
  return markdown
    .replace(new RegExp(FENCE_RE.source, 'g'), (match, info: string, body: string) =>
      fenceToProposal(info, body) ? '' : match,
    )
    .trim();
}
