# ResumeMatch AI — Security Documentation

## 1. Security Architecture Summary

```text
Request → Helmet Headers → Rate Limiter → Auth (JWT) → Zod Validator → Sanitizer → Controller → Service → Resource Check
```

---

## 2. Multi-Layer Defense in Depth

### Layer 1: Transport & Header Security
- `helmet()` middleware sets standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).
- `cors()` restricts request origins strictly to `FRONTEND_URL`.

### Layer 2: Rate Limiting
- `authLimiter`: Max 10 requests / 15 minutes for `/api/auth` endpoints.
- `aiLimiter`: Max 20 requests / 15 minutes for AI endpoints (`/api/analysis`, `/api/interviews`, `/api/knowledge`).
- `generalLimiter`: Max 100 requests / 15 minutes across all general API routes.

### Layer 3: Password Hashing & JWT Security
- Passwords hashed using `bcryptjs` with **12 salt rounds**. Plaintext passwords are never stored or logged.
- JWTs signed with `JWT_SECRET`, bearing `id`, `email`, and `role`. Tokens expire in 7 days.

### Layer 4: Role-Based Authorization (RBAC)
- Middleware `requireRole("ADMIN")` protects sensitive administrative analytics routes.

### Layer 5: Input Validation & MIME Restrictions
- `Zod` schemas validate every incoming request body.
- `Multer` checks file extensions (`.pdf`, `.docx`) and MIME types, enforcing a strict 5 MB file size limit.

### Layer 6: Prompt Injection Defense
- `sanitizer.js` scans incoming resume/JD text for known injection patterns (`ignore previous instructions`, `system:`, `you are now`, `reveal your prompt`).
- System prompts wrap user input inside XML tags (`<resume>`, `<job_description>`) and explicitly instruct the LLM to treat tag contents strictly as untrusted data.
- Server-side Zod validation verifies all LLM outputs before returning data.

### Layer 7: Controlled Function Calling Authorization
- Every tool execution (`getUserApplications`, `calculateSkillGap`, `saveInterviewResult`) explicitly verifies that the requested resource `userId` matches the authenticated `req.user.id`.
