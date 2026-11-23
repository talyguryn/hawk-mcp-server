import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeTelemetry } from "../dist/src/sanitize.js";

test("redacts sensitive telemetry keys", () => {
  const result = sanitizeTelemetry({
    headers: {
      authorization: "Bearer secret",
      cookie: "session=secret",
      accept: "application/json",
    },
  });

  assert.deepEqual(result.headers.authorization, "[REDACTED]");
  assert.deepEqual(result.headers.cookie, "[REDACTED]");
  assert.equal(result.headers.accept, "application/json");
});

test("redacts JWT and bearer values embedded in strings", () => {
  const result = sanitizeTelemetry(
    "Authorization: Bearer token.value && eyJabc.def.ghi",
  );

  assert.equal(result, "Authorization: Bearer [REDACTED] && [REDACTED]");
});

test("bounds nested telemetry", () => {
  const result = sanitizeTelemetry(
    { values: Array.from({ length: 201 }, (_, index) => index) },
  );

  assert.equal(result.values.length, 201);
  assert.equal(result.values.at(-1), "[TRUNCATED]");
  assert.equal(sanitizeTelemetry("x".repeat(8_001)).endsWith("…[TRUNCATED]"), true);
});
