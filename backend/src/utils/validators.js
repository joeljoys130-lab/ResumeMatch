import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100)
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createApplicationSchema = z.object({
  company: z.string().trim().min(1, 'Company is required'),
  jobTitle: z.string().trim().min(1, 'Job title is required'),
  jobUrl: z.string().trim().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
  currentStatus: z.enum(['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED']).optional().default('SAVED'),
  jobDescriptionId: z.number().int().positive().optional()
});

export const updateApplicationSchema = z.object({
  company: z.string().trim().min(1).optional(),
  jobTitle: z.string().trim().min(1).optional(),
  jobUrl: z.string().trim().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  currentStatus: z.enum(['SAVED', 'APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED']).optional()
});

export const startInterviewSchema = z.object({
  role: z.string().trim().min(2, 'Role is required'),
  experienceLevel: z.enum(['Junior', 'Mid-Level', 'Senior', 'Lead/Principal']),
  technology: z.string().trim().min(1, 'Technology focus is required'),
  interviewType: z.enum(['Technical', 'Behavioral', 'System Design', 'General HR']),
  questionCount: z.number().int().refine(val => [5, 10, 15].includes(val), {
    message: 'Question count must be 5, 10, or 15'
  }).optional().default(5)
});

export const submitInterviewAnswerSchema = z.object({
  answer: z.string().trim().min(1, 'Answer cannot be empty')
});

export const interviewAnswerEvaluationOutputSchema = z.object({
  score: z.number().min(0).max(10),
  technicalAccuracy: z.number().min(0).max(10),
  communication: z.number().min(0).max(10),
  relevance: z.number().min(0).max(10).optional().default(5),
  feedback: z.string(),
  weakTopics: z.array(z.string()).optional(),
  missingConcepts: z.array(z.string()).optional(),
  strengths: z.array(z.string()).optional(),
  followUpQuestion: z.string().optional()
});

export const ragQuerySchema = z.object({
  query: z.string().trim().min(3, 'Query must be at least 3 characters'),
  conversationId: z.string().optional()
});

export const resumeAnalysisOutputSchema = z.object({
  matchScore: z.number().min(0).max(100),
  atsScore: z.number().min(0).max(100),
  experienceMatch: z.string(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string()
});
