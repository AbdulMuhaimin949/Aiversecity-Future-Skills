/**
 * In-memory sliding-window limits for the public assistant endpoints, so the
 * page cannot drain the Gemini quota or fill the database.
 */
const WINDOW_MS = 10 * 60 * 1000;

class SlidingWindow {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number) {}

  /** Seconds until a slot frees up, or 0 if `key` is under the limit. */
  wait(key: string, now: number): number {
    const xs = (this.hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (xs.length) this.hits.set(key, xs);
    else this.hits.delete(key);
    return xs.length >= this.limit ? Math.max(1, Math.ceil((WINDOW_MS - (now - xs[0]!)) / 1000)) : 0;
  }

  record(key: string, now: number) {
    const xs = this.hits.get(key) ?? [];
    xs.push(now);
    this.hits.set(key, xs);
  }
}

/** Checks every (window, key) pair; records a hit in all of them only if none is full. */
function take(checks: [SlidingWindow, string][]): number {
  const now = Date.now();
  const wait = Math.max(0, ...checks.map(([w, k]) => w.wait(k, now)));
  if (wait === 0) for (const [w, k] of checks) w.record(k, now);
  return wait;
}

const questionsPerUser = new SlidingWindow(20);
const questionsGlobal = new SlidingWindow(200);
const sessionsPerIp = new SlidingWindow(20);
const sessionsGlobal = new SlidingWindow(300);

/** Returns seconds to wait if a question limit is hit, otherwise records it and returns 0. */
export function takeQuestionSlot(userId: string): number {
  return take([
    [questionsPerUser, userId],
    [questionsGlobal, "all"],
  ]);
}

/**
 * Limits new chat sessions (and the guest users they create) per client IP
 * and globally, independently of the question limits.
 */
export function takeSessionSlot(ip: string): number {
  return take([
    [sessionsPerIp, ip],
    [sessionsGlobal, "all"],
  ]);
}

/** Maximum non-deleted sessions one guest may keep. */
export const MAX_SESSIONS_PER_GUEST = 30;

const extractionsPerUser = new SlidingWindow(5);
const extractionsGlobal = new SlidingWindow(60);
const appealsPerUser = new SlidingWindow(10);
const appealsGlobal = new SlidingWindow(200);
const guestsPerIp = new SlidingWindow(20);

/** AI claim extraction on demo CVs (each call spends Gemini quota). */
export function takeCvExtractionSlot(userId: string): number {
  return take([
    [extractionsPerUser, userId],
    [extractionsGlobal, "all"],
  ]);
}

export function takeAppealSlot(userId: string): number {
  return take([
    [appealsPerUser, userId],
    [appealsGlobal, "all"],
  ]);
}

/** New guest identities created by the CV review pages, per client IP. */
export function takeGuestCreationSlot(ip: string): number {
  return take([[guestsPerIp, ip]]);
}
