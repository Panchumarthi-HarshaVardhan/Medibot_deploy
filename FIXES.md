# Bug Fixes & Security Improvements

## Critical Bug Fixes

### 1. White Screen After Login (+ Multi-Account Isolation)
**File:** `src/hooks/useAuth.ts`
- Switched from `localStorage` to `sessionStorage` — each browser tab now has its own isolated session
- Added shape validation when loading the stored user (validates `id`, `email`, `role`)
- Added `token` field to User type and stores JWT issued by server

### 2. Error Boundary
**File:** `src/components/ErrorBoundary.tsx` (new)
- Wraps `<AppRoutes>` in `App.tsx` — rendering errors now show a friendly message + reload button instead of a blank white screen

## Security Fixes

### 3. JWT Authentication Middleware
**File:** `server/index.js`
- All protected routes now require a `Bearer <token>` header
- Token issued on successful OTP verify and Google auth
- `requireAuth` middleware validates and decodes JWT on every protected request

### 4. Ownership Checks on All Routes
**File:** `server/index.js`
- Appointments, medications, prescriptions, profile — all now verify `req.user.id` matches the resource owner
- Doctors cannot modify other doctors' prescriptions
- Patients cannot view other patients' data

### 5. OTP State Moved to MongoDB
**File:** `server/index.js`
- Removed `pendingSignups` and `pendingOtps` in-memory Maps
- OTP fields stored directly on User document (`otpCode`, `otpPurpose`, `otpExpiresAt`)
- Survives server restarts; no memory leak

### 6. Rate Limiting
**File:** `server/index.js`
- Auth endpoints: 20 req / 10 min per IP
- AI endpoints: 15 req / min per IP

### 7. CORS Locked to Frontend Origin
**File:** `server/index.js`
- `app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))`
- Set `FRONTEND_URL` in `.env`

## Agentic AI Fixes

### 8. Shared Conversation History → Per-Session Map
**File:** `server/agents/ChatbotAgent.js`
- Replaced `this.conversationHistory = []` with `this.sessionHistories = new Map()` keyed by `userId`
- Sliding window of 20 turns per session (auto-evicts old turns)

### 9. MedicalHistoryAnalyzerAgent Wired Through Chatbot
**File:** `server/agents/ChatbotAgent.js`
- Added `analyze_history` action to router prompt and `getFallbackRoute()`
- Chatbot now routes "analyze my history" messages to `MedicalHistoryAnalyzerAgent`

### 10. Redundant SymptomChecker Back-Call Removed
**File:** `server/agents/SymptomCheckerAgent.js`
- Removed `await this.sendMessage('ChatbotAgent', analysisResult)` — ChatbotAgent already awaits the return value

### 11. `pendingActions` TTL Eviction
**File:** `server/agents/ChatbotAgent.js`
- Added `evictStalePendingActions()` method called every 60s from `server/index.js`

## Code Quality Fixes

### 12. Centralised Frontend API URL
**File:** `src/utils/api.ts` (new)
- `API_BASE` reads from `import.meta.env.VITE_API_URL`
- `authHeaders()` helper injects JWT token into all fetch calls
- All 15+ hardcoded `http://localhost:3000` occurrences replaced

### 13. Removed Unused Dependencies
**File:** `package.json`
- Removed `mysql2` (not used anywhere)
- Removed `@google/generative-ai` (project fully on Groq)
- Added `jsonwebtoken` and `express-rate-limit`

### 14. Fixed `_id` vs `id` Mismatch
**File:** `src/pages/MedicalHistory.tsx`
- Frontend User type uses `id`, not `_id`; all references corrected

## Setup After Unzipping

1. Copy `.env.example` → `.env` and fill in all values
2. Generate `JWT_SECRET`: `node -e "require('crypto').randomBytes(32).toString('hex')"`
3. Set `FRONTEND_URL=http://localhost:5173` (or your deployed URL)
4. Set `VITE_API_URL=http://localhost:3000` (or your deployed API URL)
5. Run `npm install` (package-lock removed due to dependency changes)
6. `npm run dev` (frontend) + `node server/index.js` (backend)
