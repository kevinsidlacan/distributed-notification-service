import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { generateRecipients } from '../utils/generateRecipients';

const router = Router();

interface CreateCampaignBody {
  name: string;
  recipientCount?: number;
}

// POST /campaigns — Create a new campaign with batch message inserts
router.post('/', async (req: Request<{}, {}, CreateCampaignBody>, res: Response): Promise<void> => {
  try {
    const { name, recipientCount = 100 } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Campaign name is required.' });
      return;
    }

    if (recipientCount > 100000) {
      res.status(400).json({ error: 'Maximum 100,000 recipients per campaign.' });
      return;
    }

    const recipients = generateRecipients(recipientCount);

    const campaign = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const newCampaign = await tx.campaign.create({
        data: {
          name,
          totalMessages: recipients.length,
          status: 'pending',
        },
      });

      // Batch insert messages in chunks of 1000
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
      }

      return newCampaign;
    });

    res.status(202).json({
      campaignId: campaign.id,
      name: campaign.name,
      totalMessages: campaign.totalMessages,
      status: campaign.status,
      message: 'Campaign created. Messages will be processed shortly.',
    });

  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /campaigns/:id — Get campaign details with message progress
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            messages: true,
          },
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

// GET /campaigns — List all campaigns (most recent first)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
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
