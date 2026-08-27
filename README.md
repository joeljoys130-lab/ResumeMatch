# ResumeMatch AI — AI Career Intelligence Platform

A full-stack, production-quality monorepo designed for resume-to-job compatibility analysis, job application tracking, vector embedding RAG career guidance, adaptive AI mock interview practice, and LLM usage monitoring.

---

## Features Overview

- **Secure JWT & Password Hashing**: Sign up / Log in with `bcryptjs` (12 rounds) and role-based authorization (`USER` / `ADMIN`).
- **Resume Upload & Text Extraction**: Parsing support for PDF (`pdf-parse`) and DOCX (`mammoth`) files up to 5 MB with automatic temporary file cleanup.
- **Claude AI Resume Matching**: Analyzes compatibility using Anthropic Claude API with strict system prompts, XML input delimiters, server-side Zod validation, and 1-step automatic retry logic for malformed JSON.
- **Prompt Injection Defense**: Defense-in-depth sanitization layer detecting suspicious instruction overrides (`ignore previous instructions`, `system:`).
- **Redis Caching**: Caches identical resume-to-JD analysis queries using SHA-256 hashes (`SHA-256(resumeText + jobDescriptionText)`) with 24-hour TTL and fault-tolerant fallback.
- **Dual-Database Architecture**:
  - **PostgreSQL + Prisma ORM**: Strongly relational data (`users`, `job_descriptions`, `applications`, `application_status_history`, `interview_sessions`, `interview_questions`).
  - **MongoDB + Mongoose**: Semi-structured AI documents (`ResumeAnalysis`, `AIConversation`, `LLMResponse`, `EvaluationResult`, `KnowledgeDocument`).
- **Transactional Consistency**: Uses **Prisma Transactions** for atomic multi-write operations (e.g. creating applications & initial status history, updating status history).
- **Embedding-based RAG**: Vector similarity search over markdown knowledge documents (`resume-writing.md`, `ats-guidelines.md`, `interview-prep.md`, `career-advice.md`) with source citations.
- **Controlled Function Calling**: Authorized tool execution (`getUserApplications`, `calculateSkillGap`, `saveInterviewResult`) where the LLM requests actions without direct DB access.
- **Adaptive Multi-step AI Interview Agent**: Stateful mock interview practice with progressive scoring, follow-ups, and final report synthesis.
- **MongoDB Aggregation Analytics**: Admin dashboard displaying token usage, estimated costs, latency, cache hit rates, and top missing skills using `$match`, `$group`, `$unwind`, `$sort`, `$project`.
- **Scheduled Background Jobs**: `node-cron` scheduled tasks for weekly career summaries and stale application reminders.
- **LLM Evaluation Suite**: Programmatic test suite (25 test cases) evaluating schema validity, score calibration, skill coverage, and prompt injection resistance.

---

## Quick Start Guide

### Prerequisites
- Node.js v20+
- Docker Desktop & Docker Compose (or local PostgreSQL, MongoDB, Redis instances)

### Option A: Local Development Setup with Docker Services

```bash
# 1. Start Database & Redis Services
docker compose -f docker-compose.dev.yml up -d

# 2. Install & Configure Backend
cd backend
npm install
cp .env.example .env
# Fill in ANTHROPIC_API_KEY in .env if available

# Initialize PostgreSQL schema & seed demo data
npm run db:init

# Seed RAG Knowledge Base
npm run start # or node src/server.js in dev mode

# Start Backend Dev Server
npm run dev

# 3. Install & Start Frontend (in a new terminal)
cd ../frontend
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser!

### Dev Demo Accounts:
- **Standard User**: `demo@resumematch.ai` / Password: `Password123!`
- **Admin Account**: `admin@resumematch.ai` / Password: `AdminPassword123!`

---

## Option B: Full Containerized Stack (Production Docker Compose)

```bash
# Start all 5 containerized services (Postgres, Mongo, Redis, Backend, Frontend)
docker compose up --build
```
Access the application at `http://localhost:3000`.

---

## Testing & Evaluation Commands

```bash
# Run Jest & Supertest Integration Suite
cd backend
npm test

# Run LLM Evaluation Dataset (25 cases)
cd backend
npm run evaluate
```
