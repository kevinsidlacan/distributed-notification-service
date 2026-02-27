import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import { NOTIFICATION_QUEUE, NotificationJobData } from './lib/queue';
import { REDIS_CONNECTION } from './lib/redis';
import prisma from './lib/prisma';
import {
  processNotificationJob,
  updateCampaignProgress,
} from './worker/workerFunctions';

const worker = new Worker<NotificationJobData>(
  NOTIFICATION_QUEUE,
  async (job: Job<NotificationJobData>) => {
    await processNotificationJob(job);
  },
  {
    connection: REDIS_CONNECTION,
    concurrency: 10,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  }
);

worker.on('completed', async (job: Job<NotificationJobData>) => {
  await updateCampaignProgress(job.data.campaignId);
});

worker.on('failed', async (job: Job<NotificationJobData> | undefined, error: Error) => {
  if (!job) return;

  const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 3);

  if (isLastAttempt) {
    await prisma.campaign.update({
      where: { id: job.data.campaignId },
      data: { failedCount: { increment: 1 } },
    });

    await updateCampaignProgress(job.data.campaignId);
    console.error(`Message ${job.data.messageId} permanently failed: ${error.message}`);
  }
});

worker.on('ready', () => {
  console.log('🔧 Notification worker is ready and listening for jobs');
});

worker.on('error', (error: Error) => {
  console.error('Worker error:', error);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('🚀 Notification worker started');
