# ResumeMatch AI — Product Requirements Document (PRD)

## 1. Product Overview & Vision

**Product Name**: ResumeMatch AI  
**Vision**: To empower job seekers worldwide with an intelligent, automated, data-driven AI platform that optimizes resume alignment, identifies skill deficits, provides realistic mock interview practice, and streamlines career progression.

---

## 2. Problem Statement & Target Audience

### Problem Statement
In today's competitive job market, candidates often send hundreds of generic resumes without understanding why they fail initial ATS screenings. Resume filtering systems discard candidates due to missing keywords, non-standard formatting, or unaligned experience. Furthermore, job seekers lack accessible tools to practice technical and behavioral interviews tailored to specific job postings.

### Target Users & Personas

* **Persona 1: Alex — Active Job Hunter (Software Engineer)**
  * *Needs*: Wants immediate feedback on whether his resume aligns with senior frontend engineer job postings. Needs a breakdown of missing skills and keywords before applying.
* **Persona 2: Priya — Career Switcher (Data Analyst to ML Engineer)**
  * *Needs*: Wants to identify skill gaps, ask career transition questions via RAG career guidance, and practice mock technical interviews.
* **Persona 3: System Administrator (Admin)**
  * *Needs*: Requires operational visibility into platform analytics, token costs, latency, LLM response logs, and overall user activity.

---

## 3. Goals & Key Performance Indicators (KPIs)

* **Resume Match Accuracy**: Achieve > 90% schema validation precision on automated ATS scoring and skill extraction.
* **Response Speed**: Deliver cached resume analysis within < 200 ms; fresh Gemini AI analysis within < 4 seconds.
* **Interview Practice Engagement**: Enable multi-step adaptive interview practice with progressive feedback scoring.
* **System Reliability**: Maintain 99.9% uptime with fail-open Redis caching and structured fallback handling.

---

## 4. Functional Requirements (FR)

### FR-1: User Authentication & Account Management
* **FR-1.1**: User registration with email, name, and password hashed using `bcryptjs` (12 rounds).
* **FR-1.2**: User login returning stateless JSON Web Tokens (JWT) valid for 7 days.
* **FR-1.3**: Role-Based Access Control (`USER` and `ADMIN` roles). Standard users are restricted from administrative routes.
* **FR-1.4**: Token-authenticated session retrieval via `GET /api/auth/me`.

### FR-2: Document Parsing & Input Sanitization
* **FR-2.1**: Support resume file uploads in PDF (`.pdf`) and Word (`.docx`) formats up to 5 MB.
* **FR-2.2**: Automatic server-side text extraction using `pdf-parse` and `mammoth` with immediate temporary file unlinking.
* **FR-2.3**: Input sanitization via `sanitizer.js` detecting and stripping prompt injection vectors (`ignore previous instructions`, `system:`, `reveal prompt`).

### FR-3: AI Resume & Job Description Analysis
* **FR-3.1**: Compute Overall Compatibility Match Score (0–100%) and ATS Format Compliance Score (0–100%).
* **FR-3.2**: Extract list of matched skills present in both resume and job description.
* **FR-3.3**: Extract missing skills required by target role but absent in candidate resume.
* **FR-3.4**: Generate actionable improvement recommendations and concise executive summary.
* **FR-3.5**: Enforce structured JSON responses from Google Gemini 3.6 Flash via Zod schema runtime validation.

### FR-4: Deterministic Caching & Deduplication
* **FR-4.1**: Compute SHA-256 hash `SHA-256(resumeText + jobDescription)` for every incoming analysis request.
* **FR-4.2**: Check Redis cache for identical hash matches before invoking external LLM APIs.
* **FR-4.3**: Store analysis results in Redis with 24-hour (86,400s) TTL.
* **FR-4.4**: Fail-open design: If Redis is offline, bypass cache silently without breaking user requests.

### FR-5: Job Application Tracking System
* **FR-5.1**: Create and manage target job applications (Company, Position, Job Description, Status, Match Score).
* **FR-5.2**: Update application statuses (`APPLIED`, `INTERVIEWING`, `OFFER`, `REJECTED`, `ARCHIVED`).
* **FR-5.3**: Record complete audit trail of status updates in PostgreSQL `ApplicationStatusHistory` via Prisma transactions (`$transaction`).

### FR-6: Embedding-Based RAG Career Assistant
* **FR-6.1**: Maintain vector store of career advice chunks (`resume-writing.md`, `ats-guidelines.md`, `interview-prep.md`, `career-advice.md`) in MongoDB.
* **FR-6.2**: Generate 768-dimensional query vector embeddings using `gemini-embedding-2`.
* **FR-6.3**: Perform cosine similarity search to retrieve top-K relevant knowledge chunks.
* **FR-6.4**: Deliver token-by-token progressive streaming responses over HTTP Server-Sent Events (SSE).
* **FR-6.5**: Include source document citations in assistant answers.

### FR-7: Controlled Function Calling
* **FR-7.1**: Expose backend-controlled tool declarations (`calculateSkillGap`, `getUserApplications`, `getResumeAnalysis`, `saveInterviewResult`) to Gemini API.
* **FR-7.2**: Backend intercepts tool call execution, verifies user authorization, executes database reads/writes, and returns payload to Gemini. The LLM has zero direct database connectivity.

### FR-8: Adaptive Multi-step AI Mock Interview Agent
* **FR-8.1**: Initialize mock interview sessions tailored to target job roles.
* **FR-8.2**: Dynamically generate role-specific interview questions using Gemini 3.6 Flash.
* **FR-8.3**: Evaluate candidate answers, compute scores (0–100), provide qualitative feedback, and adapt follow-up questions based on prior answers.
* **FR-8.4**: Synthesize final interview performance report upon session completion.

### FR-9: Admin Analytics & System Monitoring
* **FR-9.1**: Restrict access to `ADMIN` users via `roleAuth.js` middleware.
* **FR-9.2**: MongoDB aggregation pipelines aggregating user metrics, application counts, token usage, latency metrics, and top missing skills platform-wide.

### FR-10: Automated Background Jobs
* **FR-10.1**: Scheduled background tasks (`node-cron`) for periodic analytics aggregation and cleanup.

---

## 5. Non-Functional Requirements (NFR)

| ID | Category | Requirement Description |
|---|---|---|
| **NFR-1** | **Performance** | Cached analysis responses delivered in < 200 ms. Fresh Gemini LLM responses delivered in < 4.0 seconds. |
| **NFR-2** | **Scalability** | Dual-database separation: Relational ACID entities in PostgreSQL; high-volume AI documents in MongoDB. |
| **NFR-3** | **Security** | Passwords hashed with bcrypt (12 rounds). Stateless JWT authentication. Strict input sanitization and prompt boundaries. Secrets stored exclusively in `.env`. |
| **NFR-4** | **Reliability** | 99.9% availability goal. Fail-open Redis caching. Graceful handling of Gemini API rate limits (`429 RESOURCE_EXHAUSTED`). |
| **NFR-5** | **Usability** | Fully responsive React SPA layout supporting desktop, tablet, and mobile screens. Glassmorphic dark UI with accessibility contrast scores. |
| **NFR-6** | **Maintainability** | Automated Jest unit & integration test suite (`npm test`). Programmatic LLM evaluation suite (`npm run evaluate`). Docker multi-stage builds. |

---

## 6. User Stories & Acceptance Criteria

### User Story 1: Analyze Resume Against Job Description
* **As a** job seeker,  
* **I want to** upload my resume PDF and paste a job description,  
* **So that** I can see my ATS score, match score, matched skills, missing skills, and improvement recommendations.  
* **Acceptance Criteria**:
  1. System accepts PDF or DOCX files up to 5 MB.
  2. System displays a visual radial gauge for Match Score and ATS Score.
  3. System lists missing skills clearly with actionable suggestions.
  4. Identical upload requests within 24 hours return instant cached responses.

### User Story 2: Practice AI Mock Interview
* **As a** candidate preparing for an interview,  
* **I want to** participate in an interactive AI mock interview,  
* **So that** I can receive real-time feedback on my answers and practice follow-up questions.  
* **Acceptance Criteria**:
  1. Candidate specifies target role to start session.
  2. System generates role-tailored questions one by one.
  3. System evaluates answers, outputs scores, and adapts subsequent questions.
  4. Final summary report summarizes overall performance.

### User Story 3: RAG Career Guidance Chat
* **As a** candidate seeking career advice,  
* **I want to** ask career guidance questions,  
* **So that** I receive grounded answers backed by expert career literature.  
* **Acceptance Criteria**:
  1. System streams response progressive token-by-token over SSE.
  2. Answers cite specific knowledge documents used as context.

---

## 7. Future Enhancements

1. **OAuth 2.0 Integration**: Add Google and GitHub Single Sign-On (SSO).
2. **Multi-File Batch Analysis**: Support comparing one resume against multiple job descriptions simultaneously.
3. **Audio-Based Mock Interviews**: Speech-to-text and text-to-speech integration for real-time voice practice.
