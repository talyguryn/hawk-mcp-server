import { ClientError, GraphQLClient, gql } from "graphql-request";

import { HAWK_API_URL, HAWK_REQUEST_TIMEOUT_MS } from "./config.js";
import { SessionStore, type HawkTokens } from "./session-store.js";

export class ReauthenticationRequiredError extends Error {
  constructor(message = "Hawk session has expired. Run the login tool again.") {
    super(message);
    this.name = "ReauthenticationRequiredError";
  }
}

export function createClient(accessToken?: string): GraphQLClient {
  if (
    !Number.isInteger(HAWK_REQUEST_TIMEOUT_MS) ||
    HAWK_REQUEST_TIMEOUT_MS < 1
  ) {
    throw new Error("HAWK_REQUEST_TIMEOUT_MS must be a positive integer.");
  }

  return new GraphQLClient(HAWK_API_URL, {
    signal: AbortSignal.timeout(HAWK_REQUEST_TIMEOUT_MS),
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : {},
  });
}

export function isRefreshableAuthenticationError(error: unknown): boolean {
  if (!(error instanceof ClientError)) {
    return false;
  }

  if (error.response.status === 401) {
    return true;
  }

  return (error.response.errors ?? []).some((graphqlError) => {
    const message = graphqlError.message.toLowerCase();
    const code = String(
      (graphqlError.extensions as { code?: unknown } | undefined)?.code ?? "",
    ).toUpperCase();

    return (
      code === "UNAUTHENTICATED" ||
      message.includes("jwt") ||
      message.includes("token expired") ||
      message.includes("access token expired") ||
      message.includes("need to refresh") ||
      message.includes("needs to refresh") ||
      message.includes("need refresh") ||
      message.includes("refresh your token") ||
      message.includes("refresh your tokens") ||
      message.includes("tokens have expired") ||
      message.includes("session expired") ||
      message.includes("invalid token") ||
      message.includes("unauthenticated")
    );
  });
}

function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!(error instanceof ClientError)) {
    return false;
  }

  return (
    error.response.status === 401 ||
    isRefreshableAuthenticationError(error) ||
    (error.response.errors ?? []).some((graphqlError) => {
      const message = graphqlError.message.toLowerCase();

      return (
        message.includes("invalid refresh token") ||
        message.includes("refresh token expired") ||
        message.includes("refresh token is invalid") ||
        message.includes("refresh token revoked") ||
        message.includes("session expired")
      );
    })
  );
}

export function formatUnknownError(error: unknown): string {
  if (error instanceof ReauthenticationRequiredError) {
    return error.message;
  }

  if (error instanceof ClientError) {
    const graphqlMessages = error.response.errors
      ?.map((item) => item.message)
      .filter(Boolean);

    if (graphqlMessages?.length) {
      return `Hawk GraphQL error: ${graphqlMessages.join("; ")}`;
    }

    return `Hawk request failed with HTTP status ${error.response.status}.`;
  }

  if (error instanceof Error) {
    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timed out")
    ) {
      return `Hawk request timed out after ${HAWK_REQUEST_TIMEOUT_MS}ms. The server did not send response headers in time.`;
    }

    return error.message;
  }

  return "Unknown error while communicating with Hawk.";
}

export function createAuthenticatedRequester(sessionStore: SessionStore) {
  let refreshInProgress: Promise<HawkTokens> | null = null;

  const refreshSession = (expiredSession: HawkTokens): Promise<HawkTokens> => {
    if (refreshInProgress) {
      return refreshInProgress;
    }

    refreshInProgress = (async () => {
      const latestSession = await sessionStore.read();

      // Another request may have refreshed the rotating token pair while this
      // request was in flight.
      if (
        latestSession &&
        latestSession.accessToken !== expiredSession.accessToken
      ) {
        return latestSession;
      }

      const refreshResult = await createClient().request<{
        refreshTokens: HawkTokens;
      }>(
        gql`
          mutation RefreshTokens($refreshToken: String!) {
            refreshTokens(refreshToken: $refreshToken) {
              accessToken
              refreshToken
            }
          }
        `,
        { refreshToken: expiredSession.refreshToken },
      );

      await sessionStore.write(refreshResult.refreshTokens);
      return refreshResult.refreshTokens;
    })().finally(() => {
      refreshInProgress = null;
    });

    return refreshInProgress;
  };

  return async function requestAuthenticated<T>(
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const session = await sessionStore.read();

    if (!session) {
      throw new ReauthenticationRequiredError(
        "No saved Hawk session. Ask the user for their Hawk email and password and call the login tool. Do not use browser login.",
      );
    }

    try {
      return await createClient(session.accessToken).request<T>(
        document,
        variables,
      );
    } catch (originalError) {
      if (!isRefreshableAuthenticationError(originalError)) {
        throw originalError;
      }

      try {
        const refreshedTokens = await refreshSession(session);

        try {
          return await createClient(refreshedTokens.accessToken).request<T>(
            document,
            variables,
          );
        } catch (retriedError) {
          if (isRefreshableAuthenticationError(retriedError)) {
            await sessionStore.clear();

            throw new ReauthenticationRequiredError(
              "Hawk rejected the refreshed session. Ask the user for their Hawk email and password and call the login tool. Do not use browser login.",
            );
          }

          throw retriedError;
        }
      } catch (refreshError) {
        if (isInvalidRefreshTokenError(refreshError)) {
          await sessionStore.clear();

          throw new ReauthenticationRequiredError(
            "Hawk refresh token is invalid or expired. Ask the user for their Hawk email and password and call the login tool. Do not use browser login.",
          );
        }

        throw refreshError;
      }
    }
  };
}
