import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { enqueueNotifications } from '../lib/queue';
import { generateRecipients } from '../utils/generateRecipients';
import { requireAuth } from '../middleware/auth';

const router = Router();

interface CreateCampaignBody {
  name: string;
  recipientCount?: number;
  targetEmail?: string;
}

router.post('/', requireAuth, async (req: Request<{}, {}, CreateCampaignBody>, res: Response): Promise<void> => {
  try {
    const { name, recipientCount = 100, targetEmail } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Campaign name is required.' });
      return;
    }

    if (recipientCount > 100000) {
      res.status(400).json({ error: 'Maximum 100,000 recipients per campaign.' });
      return;
    }

    let recipients = generateRecipients(recipientCount);
    
    // If a target test email is provided, ensure it's in the list so a real email goes out
    if (targetEmail && targetEmail.trim() !== '') {
      // Add it to the top of the list so it gets processed quickly
      recipients = [targetEmail.trim(), ...recipients.slice(0, recipientCount - 1)];
    }

    const { campaign, messages } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newCampaign = await tx.campaign.create({
        data: {
          name,
          totalMessages: recipients.length,
          status: 'pending',
        },
      });

      const createdMessages: { id: string; recipient: string }[] = [];
      const BATCH_SIZE = 1000;

      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        await tx.message.createMany({
          data: batch.map((recipient) => ({
            recipient,
            campaignId: newCampaign.id,
            status: 'pending',
          })),
        });

        // Collect created message IDs for queue enqueueing
        const created = await tx.message.findMany({
          where: { campaignId: newCampaign.id, recipient: { in: batch } },
          select: { id: true, recipient: true },
        });
        createdMessages.push(...created);
      }

      return { campaign: newCampaign, messages: createdMessages };
    });

    // Enqueue jobs and mark campaign as processing
    await enqueueNotifications(campaign.id, messages);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'processing' },
    });

    res.status(202).json({
      campaignId: campaign.id,
      name: campaign.name,
      totalMessages: campaign.totalMessages,
      status: 'processing',
      message: 'Campaign created and queued for processing.',
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/:id', requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    const statusCounts = await prisma.message.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { _all: true },
    });

    const progress: Record<string, number> = {};
    for (const item of statusCounts) {
      progress[item.status] = item._count._all;
    }

    res.json({
      ...campaign,
      progress,
    });
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/:id/retry', requireAuth, async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const failedMessages = await prisma.message.findMany({
      where: { campaignId: id, status: 'failed' },
      select: { id: true, recipient: true },
    });

    if (failedMessages.length === 0) {
      res.status(400).json({ error: 'No failed messages to retry.' });
      return;
    }

    await prisma.message.updateMany({
      where: { campaignId: id, status: 'failed' },
      data: { status: 'queued', lastError: null },
    });

    await prisma.campaign.update({
      where: { id },
      data: {
        status: 'processing',
        failedCount: { decrement: failedMessages.length },
      },
    });

    await enqueueNotifications(id, failedMessages);

    res.json({ retriedCount: failedMessages.length });
  } catch (error) {
    console.error('Error retrying failed messages:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Error listing campaigns:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;

