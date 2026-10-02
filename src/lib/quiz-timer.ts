export function remainingQuestionSeconds(
  timeLimit: number,
  startedAt: string | null | undefined,
  now = Date.now()
): number {
  if (!Number.isFinite(timeLimit) || timeLimit <= 0) return 0;

  const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (!Number.isFinite(startedAtMs)) return Math.ceil(timeLimit);

  const elapsedSeconds = (now - startedAtMs) / 1000;
  return Math.max(0, Math.min(Math.ceil(timeLimit), Math.ceil(timeLimit - elapsedSeconds)));
}