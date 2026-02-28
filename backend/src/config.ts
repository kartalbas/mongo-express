import fs from 'node:fs';
import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(3000),
  mongodbUrl: z.string().min(1, 'ME_CONFIG_MONGODB_URL is required'),
  mongodbAdmin: z.boolean().default(false),
  mongodbTls: z.boolean().default(false),
  mongodbTlsAllowInvalidCerts: z.boolean().default(false),
  mongodbTlsCaFile: z.string().optional(),
  mongodbAllowDiskUse: z.boolean().default(false),
  dataDir: z.string().default('/data'),
  sessionSecret: z.string().min(1, 'MONKO_SESSION_SECRET is required'),
  corsOrigin: z.string().default('http://localhost:5173'),
  readOnly: z.boolean().default(false),
  gridFSEnabled: z.boolean().default(false),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

function getBoolean(value: string | undefined, defaultValue = false): boolean {
  return value ? value.toLowerCase() === 'true' : defaultValue;
}

function getFileEnv(envVariable: string): string | undefined {
  const origVar = process.env[envVariable];
  const fileVar = process.env[`${envVariable}_FILE`];
  if (fileVar) {
    try {
      if (fs.existsSync(fileVar)) {
        const content = fs.readFileSync(fileVar, 'utf-8').split(/\r?\n/)[0];
        return content?.trim();
      }
    } catch {
      console.error(`Failed to read file for ${envVariable}_FILE:`, fileVar);
    }
  }
  return origVar;
}

export function loadConfig(): Config {
  const raw = {
    port: Number(process.env['PORT']) || 3000,
    mongodbUrl: getFileEnv('ME_CONFIG_MONGODB_URL') ?? '',
    mongodbAdmin: getBoolean(process.env['ME_CONFIG_MONGODB_ENABLE_ADMIN']),
    mongodbTls: getBoolean(process.env['ME_CONFIG_MONGODB_TLS']),
    mongodbTlsAllowInvalidCerts: getBoolean(process.env['ME_CONFIG_MONGODB_TLS_ALLOW_CERTS']),
    mongodbTlsCaFile: process.env['ME_CONFIG_MONGODB_TLS_CA_FILE'],
    mongodbAllowDiskUse: getBoolean(process.env['ME_CONFIG_MONGODB_ALLOW_DISK_USE']),
    dataDir: process.env['MONKO_DATA_DIR'] ?? '/data',
    sessionSecret: process.env['MONKO_SESSION_SECRET'] ?? 'dev-secret-change-me',
    corsOrigin: process.env['MONKO_CORS_ORIGIN'] ?? 'http://localhost:5173',
    readOnly: getBoolean(process.env['ME_CONFIG_OPTIONS_READONLY']),
    gridFSEnabled: getBoolean(process.env['ME_CONFIG_SITE_GRIDFS_ENABLED']),
    nodeEnv: (process.env['NODE_ENV'] ?? 'development') as 'development' | 'production' | 'test',
  };

  return configSchema.parse(raw);
}
