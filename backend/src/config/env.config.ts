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
};
