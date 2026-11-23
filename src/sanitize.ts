const SENSITIVE_KEY =
  /(?:authorization|cookie|set-cookie|token|password|secret|api[-_]?key|credential)/i;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const MAX_STRING_LENGTH = 8_000;
const MAX_ARRAY_ITEMS = 200;
const MAX_DEPTH = 12;

export function sanitizeTelemetry(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    const redacted = value.replace(JWT, "[REDACTED]").replace(BEARER, "Bearer [REDACTED]");

    return redacted.length > MAX_STRING_LENGTH
      ? `${redacted.slice(0, MAX_STRING_LENGTH)}…[TRUNCATED]`
      : redacted;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return "[TRUNCATED]";
  }

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeTelemetry(item, depth + 1));

    if (value.length > MAX_ARRAY_ITEMS) {
      sanitized.push("[TRUNCATED]");
    }

    return sanitized;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : sanitizeTelemetry(item, depth + 1),
    ]),
  );
}
