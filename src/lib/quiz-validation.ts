export function normalizeRoomCode(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function isQuizHost(hostId: string | null | undefined, userId: string): boolean {
  return hostId === userId;
}