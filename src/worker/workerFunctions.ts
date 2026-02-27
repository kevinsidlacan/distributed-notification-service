import { Job } from 'bullmq';
import { NotificationJobData } from '../lib/queue';
import prisma from '../lib/prisma';

const FAILURE_RATE = 0.2;
const SIMULATED_LATENCY_MS = 200;

export async function sendNotification(recipient: string): Promise<void> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  // Simulate random failures
  if (Math.random() < FAILURE_RATE) {
    throw new Error(`Failed to deliver notification to ${recipient}`);
  }
}

export async function updateCampaignProgress(campaignId: string): Promise<void> {
  const pendingCount = await prisma.message.count({
    where: { campaignId, status: 'pending' },
  });

  const queuedCount = await prisma.message.count({
    where: { campaignId, status: 'queued' },
  });

  if (pendingCount === 0 && queuedCount === 0) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (campaign) {
      const status = campaign.failedCount > 0 ? 'completed_with_failures' : 'completed';
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status },
      });
      console.log(`Campaign ${campaignId} ${status} (sent: ${campaign.sentCount}, failed: ${campaign.failedCount})`);
    }
  }
}

export async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { messageId, campaignId, recipient } = job.data;

  try {
    await sendNotification(recipient);

    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'sent',
        attempts: job.attemptsMade + 1,
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: 1 } },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: job.attemptsMade + 1 >= (job.opts.attempts || 3) ? 'failed' : 'queued',
        attempts: job.attemptsMade + 1,
        lastError: errorMessage,
      },
    });

    throw error; // Rethrow to let BullMQ handle retries
  }
}
