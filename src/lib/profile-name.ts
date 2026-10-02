export function displayNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  for (const key of ['name', 'full_name', 'display_name']) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}