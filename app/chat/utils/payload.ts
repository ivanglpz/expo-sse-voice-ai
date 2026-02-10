export const readStringField = (payload: unknown, key: string): string => {
  if (typeof payload !== "object" || payload === null || !(key in payload)) {
    return "";
  }

  return String((payload as Record<string, unknown>)[key] ?? "");
};
