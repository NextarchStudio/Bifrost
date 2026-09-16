import { secureSettings, type DatabaseConnection } from "@bifrost/database";
import { decryptValue, encryptValue, loadOrCreateKeyFile } from "@bifrost/security";
import { eq } from "drizzle-orm";

export interface SecureSettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, updatedByUserId?: number): Promise<void>;
}

export async function createSecureSettingsStore(
  database: DatabaseConnection,
  keyFile: string,
): Promise<SecureSettingsStore> {
  const keyVersion = 1;
  const masterKey = await loadOrCreateKeyFile(keyFile);
  const keys = new Map([[keyVersion, masterKey]]);

  return {
    async get(key: string): Promise<string | null> {
      const [row] = await database.db
        .select({ encryptedValue: secureSettings.encryptedValue, keyVersion: secureSettings.keyVersion })
        .from(secureSettings)
        .where(eq(secureSettings.key, key))
        .limit(1);
      return row ? decryptValue({ ciphertext: row.encryptedValue, keyVersion: row.keyVersion }, keys) : null;
    },

    async set(key: string, value: string, updatedByUserId?: number): Promise<void> {
      const encrypted = encryptValue(value, masterKey, keyVersion);
      const updatedAt = new Date();
      await database.db
        .insert(secureSettings)
        .values({
          key,
          encryptedValue: encrypted.ciphertext,
          keyVersion: encrypted.keyVersion,
          updatedByUserId,
          updatedAt,
        })
        .onDuplicateKeyUpdate({
          set: {
            encryptedValue: encrypted.ciphertext,
            keyVersion: encrypted.keyVersion,
            updatedByUserId,
            updatedAt,
          },
        });
    },
  };
}
