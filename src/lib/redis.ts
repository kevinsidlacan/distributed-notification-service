import { ConnectionOptions } from 'bullmq';

export const REDIS_CONNECTION: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};
