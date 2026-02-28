import { Job } from 'bullmq';
import { NotificationJobData } from '../lib/queue';
import prisma from '../lib/prisma';

import { EmailServiceFactory } from '../services/email/EmailServiceFactory';

// The old sendNotification was moved to MockEmailProvider.

export async function updateCampaignProgress(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) return;

  if (campaign.sentCount + campaign.failedCount >= campaign.totalMessages) {
    if (campaign.status === 'processing' || campaign.status === 'pending') {
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
    // --- IDEMPOTENCY GUARD ---
    // Before doing anything, check if this message was already successfully sent.
    // This protects against a crash window: if the worker sends the email but crashes
    // BEFORE writing "sent" to the DB, BullMQ will retry the job. Without this check,
    // the recipient would receive the same email twice.
    // If sentAt is already set, the email was already delivered — bail out silently.
    const existingMessage = await prisma.message.findUnique({
      where: { id: messageId },
      select: { sentAt: true },
    });
    if (existingMessage?.sentAt !== null && existingMessage?.sentAt !== undefined) {
      console.log(`[Idempotency] Message ${messageId} already sent at ${existingMessage.sentAt}. Skipping.`);
      return;
    }

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const subject = campaign ? `Notification: ${campaign.name}` : 'Notification';

    const provider = EmailServiceFactory.getProvider(recipient);
    await provider.sendEmail(
      recipient,
      subject,
      `Hello ${recipient},\n\nThis is a notification from the Distributed Notification Service.\n\nCampaign ID: ${campaignId}\nMessage ID: ${messageId}`
    );

    // Mark as sent and record the exact timestamp for the idempotency guard
    await prisma.message.update({
      where: { id: messageId },
      data: {
        status: 'sent',
        sentAt: new Date(),
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
