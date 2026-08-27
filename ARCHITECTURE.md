# ResumeMatch AI — System Architecture Documentation

## 1. High-Level System Architecture

```text
                                +-------------------+
                                |   React Frontend  |
                                |    (Vite, SPA)    |
                                +---------+---------+
                                          |
                                    Axios / SSE
                                          |
                                +---------v---------+
                                |  Express Backend  |
                                |   (ES Modules)    |
                                +----+----+----+----+
                                     |    |    |
        +----------------------------+    |    +----------------------------+
        |                                 |                                 |
+-------v-------+                 +-------v-------+                 +-------v-------+
|  PostgreSQL   |                 |    MongoDB    |                 |     Redis     |
| (Prisma ORM)  |                 |  (Mongoose)   |                 | (Cache Layer) |
+---------------+                 +---------------+                 +---------------+
| • users       |                 | • analyses    |                 | • SHA-256 key |
| • jobs        |                 | • rag_chats   |                 |   24h TTL     |
| • apps        |                 | • llm_logs    |                 +---------------+
| • app_history |                 | • eval_results|
| • interviews  |                 | • knowledge   |
+---------------+                 +---------------+
```

---

## 2. Database Responsibilities Justification

### PostgreSQL (Prisma ORM)
Chosen for **strongly relational business data**:
- **Why**: User accounts, job descriptions, application tracking, and interview session histories have clear entity relationships, strict integrity constraints, and require foreign key cascades and transactional consistency.
- **Transactions**: Used in multi-write operations (creating an application + initial status history entry, updating application status + generating an audit trail record).

### MongoDB (Mongoose)
Chosen for **semi-structured AI data**:
- **Why**: LLM analysis responses, evaluation outputs, and RAG conversation histories vary in structure, contain nested arrays/objects (`matchedSkills`, `strengths`, `recommendations`), and benefit from document-oriented schemas.
- **Analytics**: Utilizes MongoDB Aggregation Pipelines (`$match`, `$group`, `$unwind`, `$sort`, `$project`) for computing real-time platform metrics.

---

## 3. Redis Caching Strategy

- **Key Generation**: `SHA-256(normalizedResumeText + normalizedJobDescriptionText)`
- **TTL**: 86,400 seconds (24 hours)
- **Fault Tolerance**: If Redis is offline, the backend catches connection warnings and bypasses caching, ensuring core features never crash.

---

## 4. RAG (Retrieval-Augmented Generation) Architecture

```text
Knowledge Document (.md)
        ↓
   Chunking (~500 chars)
        ↓
  Embedding Generator (OpenAI / Local Vectorizer)
        ↓
  MongoDB KnowledgeDocument Store
        ↓
User Query → Query Embedding → Cosine Similarity Search → Top 3 Chunks → Claude API → Grounded Response
```

---

## 5. Controlled Function Calling Architecture

```text
Claude API Tool Call Request (e.g. getUserApplications)
        ↓
Backend Tool Execution Service (toolService.js)
        ↓
Authorization & Ownership Check (verify userId)
        ↓
Prisma / Mongoose Database Execution
        ↓
Tool Result returned to Claude
```
The LLM is **never given direct database access**.
