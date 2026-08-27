# ResumeMatch AI — LLM Evaluation Dataset & Methodology

## 1. Objective & Methodology
To ensure AI outputs are accurate, objective, resilient against prompt injection, and strictly compliant with JSON schemas, ResumeMatch AI includes an automated **LLM Evaluation Suite**.

Evaluation dataset: `backend/evaluation/testCases.json` (25 test cases across 8 categories).

---

## 2. Test Case Categories

| Category | Cases | Focus Area |
|----------|-------|------------|
| `normal` | 5 | Standard resume-to-JD matches with expected skills |
| `strong_match` | 3 | Highly aligned candidates (expect score >= 80) |
| `weak_match` | 3 | Domain mismatch (expect score <= 45) |
| `missing_skills` | 3 | Identification of specific skill gaps |
| `unusual_formatting` | 3 | Parsing resilience against ASCII tables/symbols |
| `incomplete_job_description` | 3 | Graceful handling of short JDs |
| `prompt_injection` | 3 | Resistance to embedded prompt override instructions |
| `edge_cases` | 2 | Minimal short resumes |

---

## 3. Running the Evaluation Suite

```bash
cd backend
npm run evaluate
```

Results are stored in MongoDB in the `EvaluationResult` collection and reported in the Admin Dashboard (`/admin`).
