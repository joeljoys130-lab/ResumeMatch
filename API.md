# ResumeMatch AI — REST API Documentation

All endpoints return a standardized JSON response body:
```json
{
  "success": true,
  "data": { ... }
}
```
Error response format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

## 1. Authentication Routes (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/signup` | Public | Register new user account |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue JWT |
| `GET`  | `/api/auth/me` | JWT | Get current user profile |
| `GET`  | `/api/auth/google/callback` | Public | Google OAuth redirect callback |

---

## 2. Resume Analysis Routes (`/api/analysis`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/analysis` | JWT | Upload PDF/DOCX resume + JD, run Claude match analysis |
| `GET`  | `/api/analysis` | JWT | List user's past resume analyses |
| `GET`  | `/api/analysis/:id` | JWT | Fetch single analysis result with full JSON metrics |
| `DELETE`| `/api/analysis/:id` | JWT | Remove analysis record |

---

## 3. Application Tracker Routes (`/api/applications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/applications` | JWT | Save new application + initial status history |
| `GET`  | `/api/applications` | JWT | Search/filter job applications (status, company, title) |
| `GET`  | `/api/applications/:id` | JWT | Get single application with status audit trail |
| `PATCH`| `/api/applications/:id` | JWT | Update application status & log history record |
| `DELETE`| `/api/applications/:id` | JWT | Delete job application |

---

## 4. AI Interview Agent Routes (`/api/interviews`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/interviews` | JWT | Start new adaptive mock interview session |
| `GET`  | `/api/interviews` | JWT | List user's past mock interview sessions |
| `GET`  | `/api/interviews/:id` | JWT | Fetch interview session transcript & questions |
| `POST` | `/api/interviews/:id/answer` | JWT | Submit answer to current question & receive AI score/feedback |
| `POST` | `/api/interviews/:id/complete` | JWT | Finalize interview & synthesize overall report |

---

## 5. RAG Career Assistant Routes (`/api/knowledge`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/knowledge/query` | JWT | Submit career query & receive grounded answer with citations |
| `GET`  | `/api/knowledge/stream` | JWT | SSE streaming endpoint for RAG assistant response |
| `POST` | `/api/knowledge/seed` | Admin | Ingest and vectorize markdown knowledge documents |

---

## 6. Admin Analytics Routes (`/api/admin`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/api/admin/user-analytics` | JWT | Personal user dashboard analytics |
| `GET`  | `/api/admin/analytics` | Admin | Platform-wide aggregate analytics via MongoDB aggregation |
| `GET`  | `/api/admin/llm-usage` | Admin | LLM token, cost, and latency log audit metrics |
