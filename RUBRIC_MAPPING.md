# ResumeMatch AI — Rubric to Code Mapping Matrix

| Rubric Requirement | Implemented File(s) | Feature Description | Viva Demonstration Step |
|--------------------|---------------------|---------------------|--------------------------|
| **LLM Integration** | `backend/src/services/llmService.js` | Anthropic Claude API calls with input formatting & cost logging | Show Claude API request & response log |
| **Prompt Engineering** | `backend/src/prompts/analysisPrompt.js` | System prompt with XML delimiters (`<resume>`, `<job_description>`) | Show prompt template & XML tags |
| **Structured Outputs** | `backend/src/utils/validators.js`, `llmService.js` | Server-side Zod validation of JSON schemas & 1-step retry logic | Show Zod schema parse & retry logic |
| **PostgreSQL & Prisma** | `backend/prisma/schema.prisma`, `src/config/prisma.js` | Normalized schema (`User`, `JobDescription`, `Application`, `InterviewSession`) | Show schema.prisma & `npx prisma studio` |
| **SQL Transactions** | `backend/src/controllers/applicationController.js` | `prisma.$transaction` creating application + status history audit trail | Show transactional create in controller |
| **MongoDB & Mongoose** | `backend/src/models/ResumeAnalysis.js`, `LLMResponse.js` | Semi-structured document storage for rich analysis JSON | Show Mongoose models & MongoDB queries |
| **Mongo Aggregation** | `backend/src/services/analyticsService.js` | `$match`, `$group`, `$unwind`, `$sort`, `$project` analytics pipeline | Show `getAdminPlatformAnalytics()` code |
| **Redis Caching** | `backend/src/services/cacheService.js`, `src/config/redis.js` | SHA-256 cache keying with 24-hour TTL & fault tolerance | Submit duplicate analysis; show `cached: true` |
| **Authentication (JWT & bcrypt)** | `backend/src/controllers/authController.js`, `src/middleware/auth.js` | `bcryptjs` (12 rounds) password hashing & JWT issuance/verification | Signup/login user & inspect JWT header |
| **Role Authorization (RBAC)** | `backend/src/middleware/roleAuth.js` | Closure middleware `requireRole("ADMIN")` protecting admin routes | Attempt `/api/admin/analytics` as USER role |
| **Security & Rate Limiting** | `backend/src/middleware/rateLimiter.js`, `app.js` | `helmet()`, restricted CORS, `express-rate-limit` window limiters | Rapid API requests showing HTTP 429 |
| **Prompt Injection Defense** | `backend/src/services/sanitizer.js` | Multi-layer pattern sanitization, delimiters, Zod validation | Submit resume with "ignore instructions" text |
| **File Upload & Parsing** | `backend/src/middleware/upload.js`, `src/services/parserService.js` | `multer` 5MB limit, `pdf-parse` & `mammoth` extraction with `finally` cleanup | Upload PDF & verify temp file deletion |
| **Real Embedding RAG** | `backend/src/services/ragService.js`, `embeddingService.js` | Vector embeddings, MongoDB `KnowledgeDocument`, cosine similarity, citations | Ask RAG Assistant question; show citations |
| **Controlled Function Calling** | `backend/src/services/toolService.js`, `src/prompts/schemas.js` | Controlled tools (`getUserApplications`, `calculateSkillGap`) with ownership check | Execute tool call & inspect user ownership check |
| **Adaptive Multi-Step Agent** | `backend/src/services/interviewService.js` | Stateful mock interview session & adaptive question progression | Complete 3 interview questions & generate report |
| **SSE Streaming** | `backend/src/controllers/knowledgeController.js` | Server-Sent Events (`text/event-stream`) streaming token response | Open RAG assistant; view progressive token rendering |
| **Scheduled Jobs (Cron)** | `backend/src/jobs/cronJobs.js` | `node-cron` scheduled background summary & follow-up jobs | Inspect scheduled task definitions |
| **LLM Evaluation Suite** | `backend/evaluation/testCases.json`, `runEvaluation.js` | 25 test cases evaluating schema validity, scores & injection defense | Run `npm run evaluate` in backend |
| **Automated Testing** | `backend/tests/auth.test.js`, `security.test.js` | Jest & Supertest API integration & unit tests | Run `npm test` in backend |
| **Docker & Docker Compose** | `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfiles` | Multi-stage containerized setup for Postgres, Mongo, Redis, Backend, Frontend | Run `docker-compose up --build` |
| **JS Closures** | `backend/src/middleware/roleAuth.js`, `src/utils/jsRubricDemos.js` | Higher-order middleware factory capturing outer lexical scope variables | Explain `requireRole(role)` closure |
| **JS Hoisting** | `backend/src/utils/jsRubricDemos.js` | Function declaration hoisting vs Temporal Dead Zone | Explain `demonstrateHoisting()` snippet |
| **Event Loop & Promises** | `backend/src/utils/jsRubricDemos.js`, `src/services/ragService.js` | Non-blocking async/await execution microtask vs macrotask processing | Explain `explainEventLoopSequence()` |
