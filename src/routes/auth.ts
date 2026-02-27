import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

interface RegisterBody {
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// POST /auth/register — Create a new admin account
router.post('/register', async (req: Request<{}, {}, RegisterBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: { email, passwordHash },
    });

    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.status(201).json({
      token,
      admin: { id: admin.id, email: admin.email },
    });
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /auth/login — Authenticate and receive a JWT token
router.post('/login', async (req: Request<{}, {}, LoginBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    res.json({
      token,
      admin: { id: admin.id, email: admin.email },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
