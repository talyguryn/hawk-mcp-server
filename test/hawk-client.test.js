import assert from "node:assert/strict";
import test from "node:test";

import { ClientError } from "graphql-request";

import { isRefreshableAuthenticationError } from "../dist/src/hawk-client.js";

test("recognizes Hawk's token refresh message", () => {
  const error = new ClientError(
    {
      status: 200,
      errors: [
        {
          message: "You need to refresh your tokens",
        },
      ],
    },
    {
      query: "query Test { me { id } }",
    },
  );

  assert.equal(isRefreshableAuthenticationError(error), true);
});

test("recognizes GraphQL UNAUTHENTICATED code", () => {
  const error = new ClientError(
    {
      status: 200,
      errors: [
        {
          message: "Not authorized",
          extensions: {
            code: "UNAUTHENTICATED",
          },
        },
      ],
    },
    {
      query: "query Test { me { id } }",
    },
  );

  assert.equal(isRefreshableAuthenticationError(error), true);
});

test("recognizes alternative Hawk refresh wording", () => {
  const error = new ClientError(
    {
      status: 200,
      errors: [
        {
          message: "You need to refresh tokens",
        },
      ],
    },
    {
      query: "query Test { me { id } }",
    },
  );

  assert.equal(isRefreshableAuthenticationError(error), true);
});

test("does not refresh arbitrary authorization failures", () => {
  const error = new ClientError(
    {
      status: 403,
      errors: [
        {
          message: "Administrator permissions required",
          extensions: {
            code: "FORBIDDEN",
          },
        },
      ],
    },
    {
      query: "mutation Test { removeProject(projectId: \"id\") }",
    },
  );

  assert.equal(isRefreshableAuthenticationError(error), false);
});
