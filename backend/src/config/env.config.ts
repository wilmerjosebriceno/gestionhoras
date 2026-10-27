import * as dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  jwt: {
    secret: process.env.JWT_SECRET || 'sigesp-jwt-secret-dev',
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any,
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'sigesp-refresh-secret-dev',
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
  },
  agente: {
    enabled: (process.env.AGENTE_ENABLED || 'true') === 'true',
    apiKey: process.env.AGENTE_API_KEY || '',
    baseUrl: process.env.AGENTE_BASE_URL || 'https://opencode.ai/zen/v1',
    model: process.env.AGENTE_MODEL || 'space-bunny-free',
    temperature: parseFloat(process.env.AGENTE_TEMPERATURE || '0.2'),
    maxSteps: parseInt(process.env.AGENTE_MAX_STEPS || '5', 10),
    timeoutMs: parseInt(process.env.AGENTE_TIMEOUT_MS || '60000', 10),
  },
  mantis: {
    baseUrl: process.env.MANTIS_BASE_URL || '',
    apiToken: process.env.MANTIS_API_TOKEN || '',
    timeoutMs: parseInt(process.env.MANTIS_TIMEOUT_MS || '15000', 10),
  },
};
