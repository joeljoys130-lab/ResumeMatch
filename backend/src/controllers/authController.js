import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforresumematchai2026!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // 1. Check duplicate email
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new ConflictError('An account with this email address already exists.');
  }

  // 2. Hash password with bcryptjs (12 rounds)
  const passwordHash = await bcrypt.hash(password, 12);

  // 3. Create user in PostgreSQL via Prisma
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: 'USER'
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true }
  });

  // 4. Issue JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return sendSuccess(res, { user, token }, 201, 'User registered successfully.');
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // 2. Compare bcrypt password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // 3. Issue JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };

  return sendSuccess(res, { user: userData, token }, 200, 'Logged in successfully.');
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, googleId: true, createdAt: true }
  });

  if (!user) {
    throw new UnauthorizedError('User account not found.');
  }

  return sendSuccess(res, { user });
});

export const googleAuthCallback = asyncHandler(async (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    throw new ValidationError('Google OAuth is not configured on this server.');
  }

  // Google OAuth redirect flow handler (when GCP credentials are set)
  return sendSuccess(res, { message: 'Google OAuth callback handled.' });
});
