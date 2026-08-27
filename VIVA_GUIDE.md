# ResumeMatch AI — Comprehensive Viva Defense Guide

This document contains concise, easy-to-memorize answers for oral examinations (vivas) covering every technical decision and rubric concept in ResumeMatch AI.

---

## 1. Architecture & Databases

### Q1: Why did you choose BOTH PostgreSQL and MongoDB instead of a single database?
**Answer:** PostgreSQL handles strongly relational business data (`users`, `job_descriptions`, `applications`, `interview_sessions`) requiring foreign keys, normalized schema constraints, and transactional consistency. MongoDB handles flexible/semi-structured AI outputs (`ResumeAnalysis`, `AIConversation`, `LLMResponse`, `KnowledgeDocument`) where responses vary in shape and benefit from document nesting and aggregation pipelines.

### Q2: Why did you use Prisma ORM for PostgreSQL?
**Answer:** Prisma provides type-safe query building, automated migration tracking (`prisma migrate`), schema normalization, and built-in transaction support (`prisma.$transaction`), preventing raw SQL injection vulnerabilities while fulfilling ORM requirements.

### Q3: How do PostgreSQL transactions work in your application?
**Answer:** We use `prisma.$transaction` when creating an application alongside its initial status-history row, or when updating an application status alongside logging a new status-history entry. If either write fails, both operations roll back atomically.

### Q4: Do PostgreSQL transactions make MongoDB writes atomic?
**Answer:** No. PostgreSQL and MongoDB are distinct database engines. Transactions in PostgreSQL only guarantee ACID compliance within PostgreSQL. MongoDB writes are managed separately via Mongoose documents.

---

## 2. Infrastructure & Caching

### Q5: Why is Redis used in this application and how is the cache key generated?
**Answer:** Redis caches identical resume-to-job matching queries to avoid expensive, redundant LLM API calls and reduce latency from ~2.5s to <50ms. The cache key is generated using a deterministic SHA-256 hash of normalized text: `SHA-256(resumeText + jobDescriptionText)`.

### Q6: What happens if Redis goes offline?
**Answer:** The Redis service wrapper in `config/redis.js` is fault-tolerant. If Redis is unavailable, connection errors are logged as warnings and the application seamlessly bypasses the cache, continuing to serve requests directly via Claude LLM without crashing.

---

## 3. AI & LLM Engineering

### Q7: What is Retrieval-Augmented Generation (RAG) and why is it used?
**Answer:** RAG retrieves relevant document chunks from a vector-embedded knowledge base using cosine similarity search and supplies those chunks as context to Claude before generating an answer. This grounds AI responses in factual guidelines (resume, ATS, interview rules) and prevents AI hallucinations.

### Q8: What is Prompt Injection and how does your application defend against it?
**Answer:** Prompt injection occurs when malicious text inside untrusted input attempts to override system instructions. We use a defense-in-depth approach:
1. Input pattern sanitization (`sanitizer.js`)
2. XML tags wrapping input (`<resume>...</resume>`)
3. System prompt instructions explicitly specifying user text is untrusted data
4. Server-side Zod JSON validation
5. Controlled tool authorization checks

### Q9: What is Controlled Function Calling (Tool Use)?
**Answer:** Function calling allows Claude to request backend operations (e.g. `getUserApplications`, `calculateSkillGap`). The backend strictly validates arguments with Zod and enforces ownership authorization (`userId`) before executing queries. The LLM NEVER receives direct database access.

### Q10: Why did you use Server-Sent Events (SSE) for streaming?
**Answer:** SSE provides a lightweight, unidirectional HTTP streaming connection from server to client over standard HTTP. It displays generated text progressively (improving perceived latency) without the overhead of full bidirectional WebSocket setup.

---

## 4. JavaScript Core Concepts

### Q11: How are Closures used in your codebase?
**Answer:** Higher-order middleware functions (like `requireRole("ADMIN")` in `roleAuth.js` or `validate(schema)` in `validate.js`) use closures to capture parameters in their outer lexical scope, which are accessed during request execution cycles long after the factory function has returned.

### Q12: Explain Hoisting in JavaScript with an example from your code.
**Answer:** Function declarations (like `function demonstrateHoisting()`) are hoisted to the top of their enclosing scope during the compilation phase, allowing them to be invoked prior to their line of definition in code. Variable declarations with `const`/`let` are hoisted to the "Temporal Dead Zone" and cannot be accessed before initialization.

### Q13: How does the Event Loop work in Node.js?
**Answer:** Node.js executes JavaScript on a single thread using an Event Loop. Synchronous code executes immediately on the Call Stack. Resolved Promises enter the Microtask Queue and execute immediately after the current stack clears. Timers (`setTimeout`) and I/O callbacks enter the Macrotask Queue and are processed in subsequent loop iterations.
