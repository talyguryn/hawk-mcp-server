import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";

export type HawkTokens = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Durable, per-user token storage for one local stdio MCP process.
 *
 * Token JSON is protected by filesystem permissions; it is not encrypted.
 */
export class SessionStore {
  constructor(private readonly filePath: string) {}

  async read(): Promise<HawkTokens | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);

      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "accessToken" in parsed &&
        "refreshToken" in parsed &&
        typeof parsed.accessToken === "string" &&
        typeof parsed.refreshToken === "string"
      ) {
        return {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
        };
      }

      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async write(tokens: HawkTokens): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });

    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;

    await writeFile(temporaryPath, JSON.stringify(tokens), {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, this.filePath);
    await chmod(this.filePath, 0o600).catch(() => undefined);
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }

  async hasSession(): Promise<boolean> {
    return (await this.read()) !== null;
  }
}
