# 🔍 Trinetra — AI-Powered Fake News Detector

<div align="center">

![Trinetra](https://img.shields.io/badge/Trinetra-v2.0.0-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![Django](https://img.shields.io/badge/Django-REST-092E20?style=for-the-badge&logo=django)
![FastAPI](https://img.shields.io/badge/FastAPI-ML_Engine-009688?style=for-the-badge&logo=fastapi)
![Gemini](https://img.shields.io/badge/Google-Gemini_AI-4285F4?style=for-the-badge&logo=google)

**A multi-source, AI-powered platform that verifies news credibility using 5 parallel intelligence engines.**

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Features](#-features)
- [How It Works](#-how-it-works)
- [ML Pipeline Deep Dive](#-ml-pipeline-deep-dive)
- [API Reference](#-api-reference)
- [Database Schema](#-database-schema)
- [Authentication Flow](#-authentication-flow)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)

---

## 🧠 Overview

**Trinetra** (meaning "three eyes" in Sanskrit) is a full-stack fake news detection platform that analyses news articles, claims, and images using a multi-source AI verification pipeline. It does NOT rely on a single model — instead it queries **5 independent intelligence sources simultaneously** and computes a weighted composite Trust Score (0–100).

> **Key Insight:** No single AI model can be trusted alone. Trinetra cross-references Gemini AI, HuggingFace NLP, Google Fact Check, NewsAPI corroboration, and AI-content detection to produce a robust, explainable verdict.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│              React 18 + Vite + TailwindCSS                       │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP / REST
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
┌─────────────────┐           ┌──────────────────────┐
│  Django Backend │           │  FastAPI ML Service   │
│  (Port 8000)    │           │  (Port 8001)          │
│                 │           │                       │
│  • Auth (JWT)   │           │  • Gemini AI          │
│  • User Mgmt    │           │  • HuggingFace NLP    │
│  • History DB   │           │  • Google Fact Check  │
│  • REST API     │           │  • NewsAPI            │
└────────┬────────┘           │  • AI Detector        │
         │                    └──────────┬────────────┘
         │                               │
         ▼                               ▼
   ┌──────────┐              ┌─────────────────────────┐
   │ SQLite   │              │  External AI/News APIs   │
   │ Database │              │  Google · HuggingFace   │
   └──────────┘              │  NewsAPI · Sapling AI   │
                             └─────────────────────────┘
```

The system has **3 independent services** that run concurrently:

| Service | Framework | Port | Responsibility |
|---------|-----------|------|----------------|
| `trinetra_frontend` | React + Vite | 5173 | User Interface |
| `trinetra_backend` | Django REST | 8000 | Auth, Users, History |
| `trinetra_ml` | FastAPI + Uvicorn | 8001 | AI Verification Engine |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI Framework |
| **Vite** | 7.3.1 | Build Tool & Dev Server |
| **TailwindCSS** | 3.4.3 | Styling |
| **React Router DOM** | 6.23.1 | Client-side Routing |
| **Axios** | 1.6.8 | HTTP Client |
| **Recharts** | 3.8.1 | Analytics Charts |
| **Lucide React** | 0.378.0 | Icon Library |
| **@react-oauth/google** | 0.12.1 | Google OAuth Integration |

### Backend (Django)
| Technology | Purpose |
|------------|---------|
| **Django** | Web Framework |
| **Django REST Framework** | RESTful API Layer |
| **djangorestframework-simplejwt** | JWT Authentication |
| **django-cors-headers** | Cross-Origin Resource Sharing |
| **google-auth** | Google OAuth Token Verification |
| **SQLite** | Database (dev) |

### ML Microservice (FastAPI)
| Technology | Purpose |
|------------|---------|
| **FastAPI** | Async API Framework |
| **Uvicorn** | ASGI Server |
| **google-generativeai** | Gemini AI SDK |
| **httpx** | Async HTTP Client |
| **python-dotenv** | Environment Management |
| **newspaper3k** | Article Extraction |

### External APIs
| API | Purpose |
|-----|---------|
| **Google Gemini 2.0** | Core AI reasoning & fact checking |
| **HuggingFace Inference** | BERT-based fake/real classifier |
| **Google Fact Check Tools** | Database of fact-checked claims |
| **NewsAPI** | News corroboration & real-time headlines |
| **Sapling AI** | AI-generated text detection |

---

## 📁 Project Structure

```
Fake Newz/
├── trinetra_frontend/          # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx           # Email + Google OAuth login
│   │   │   ├── Register.jsx        # User registration
│   │   │   ├── ForgotPassword.jsx  # OTP-based password reset
│   │   │   ├── Dashboard.jsx       # Recent analyses + stats
│   │   │   ├── Analyzer.jsx        # Text/URL analysis page
│   │   │   ├── ImageAnalyzer.jsx   # Screenshot/image analysis
│   │   │   ├── Analytics.jsx       # Charts & usage statistics
│   │   │   ├── Profile.jsx         # User profile management
│   │   │   └── ShareResult.jsx     # Public shareable result view
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Top navigation bar
│   │   │   ├── TrustScoreCard.jsx  # Full result display component
│   │   │   └── NewsCard.jsx        # News source card
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Global auth state (React Context)
│   │   ├── api.js                  # Axios instance + interceptors
│   │   ├── App.jsx                 # Router + Protected routes
│   │   └── main.jsx                # React entry point
│   ├── package.json
│   └── vite.config.js
│
├── trinetra_backend/           # Django REST API
│   ├── accounts/
│   │   ├── models.py           # User + OTPVerification models
│   │   ├── views.py            # Register, Login, Google Auth, OTP, Reset
│   │   ├── serializers.py      # DRF serializers
│   │   └── urls.py             # Auth endpoints
│   ├── history/
│   │   ├── models.py           # AnalysisHistory model
│   │   ├── views.py            # History CRUD endpoints
│   │   └── urls.py
│   ├── news/
│   │   ├── views.py            # Proxy → ML microservice
│   │   └── urls.py
│   ├── trinetra_backend/
│   │   └── settings.py         # Django config + JWT config
│   ├── manage.py
│   └── requirements.txt
│
└── trinetra_ml/                # FastAPI AI Engine
    ├── main.py                 # FastAPI app + /analyze + /analyze-image
    ├── analyzer.py             # Core orchestrator (v5.0)
    ├── verifiers.py            # 5 parallel verifier functions
    ├── realtime_facts.py       # Live NewsAPI context injection
    ├── diagnostic.py           # Health check script
    └── requirements.txt
```

---

## ✨ Features

### 🔐 Authentication
- **Email/Password** registration and login
- **Google OAuth 2.0** Sign-In (one-click)
- **JWT tokens** (access + refresh) for secure sessions
- **OTP-based password reset** via email (6-digit, 10-minute expiry)
- Protected routes — unauthenticated users redirected to login

### 📝 Text & URL Analysis
- Paste any **news article text** or enter a **URL**
- Automatic mode detection: **Short Claim** vs **Full Article**
- Real-time Trust Score (0–100) with 5-tier verdict

### 🖼️ Image/Screenshot Analysis
- Upload a **screenshot** of a news article or social media post
- **Gemini Vision OCR** extracts all visible text from the image
- Extracted text is then run through the full ML pipeline

### 📊 Analytics Dashboard
- Charts showing verdict distribution (Real / Likely Real / Uncertain / Likely Fake / Fake)
- Historical trend graphs
- Per-source score breakdown (Gemini, HuggingFace, NewsAPI, etc.)

### 📜 Analysis History
- Every analysis is saved to the user's account
- Filterable history view with full result details

### 🔗 Shareable Results
- Generate a public share link for any analysis result
- No login required to view shared results

---

## ⚙️ How It Works

### Step-by-Step Flow

```
User Input (Text / URL / Image)
         │
         ▼
  [Frontend: Analyzer.jsx]
  POST /api/news/analyze/
         │
         ▼
  [Django Backend: news/views.py]
  Proxies request → FastAPI ML Service
         │
         ▼
  [FastAPI: /analyze endpoint]
         │
         ├─── 1. Detect Mode: CLAIM (<400 chars) or ARTICLE (≥400 chars)
         │
         ├─── 2. Fetch Real-Time Context (if time-sensitive claim)
         │         └── NewsAPI live headlines injected into Gemini prompt
         │
         ├─── 3. Run 5 Verifiers in PARALLEL (asyncio.gather)
         │         ├── Gemini AI  ──────── Core reasoning
         │         ├── HuggingFace NLP ─── BERT classifier
         │         ├── Google Fact Check ── Claim database
         │         ├── NewsAPI ─────────── Corroboration search
         │         └── Domain Reputation ─ Source credibility
         │
         ├─── 4. Compute Weighted Composite Score
         │
         ├─── 5. Return structured AnalyzeResponse JSON
         │
         ▼
  [Django Backend]
  Save to AnalysisHistory table
         │
         ▼
  [Frontend: TrustScoreCard.jsx]
  Display Trust Score + Verdict + Per-Source breakdown
```

---

## 🤖 ML Pipeline Deep Dive

### Mode Detection

| Mode | Trigger | Behavior |
|------|---------|----------|
| **CLAIM** | Text < 400 chars OR ≤ 3 sentences | Fact-verification mode. Gemini checks if the claim is TRUE/FALSE |
| **ARTICLE** | Text ≥ 400 chars | Journalistic quality analysis. Checks sourcing, bias, red flags |

### Verifier 1 — Gemini AI (Weight: 50–80%)

The most important verifier. Uses Google's `gemini-2.0-flash-lite` (with fallback to `gemini-2.0-flash` and `gemini-2.5-flash`).

- **CLAIM mode**: Prompt asks "Is this claim TRUE or FALSE?" with injected real-time news context
- **ARTICLE mode**: Prompt evaluates journalistic quality, named sources, and red flags
- Returns: `trust_score`, `verdict`, `reasoning`, `key_claims`, `red_flags`

### Verifier 2 — HuggingFace NLP (Weight: 13%, Articles only)

Uses `mrm8488/bert-tiny-finetuned-fake-news-detection` — a BERT model fine-tuned on fake news datasets.

- Input: First 512 tokens of text
- Output: Binary `FAKE` / `REAL` classification with confidence score
- Fallback: `ProsusAI/finbert` (sentiment-based proxy)
- **Excluded for CLAIM mode** — the model is trained on articles, not single sentences

### Verifier 3 — Google Fact Check Tools (Weight: 10–15%)

Queries the official Google Fact Check Tools API to find existing fact-checks matching the content.

- Extracts keywords from the text and searches the claim database
- Counts TRUE vs FALSE ratings from verified fact-checkers
- **Fallback**: If Google API is unavailable → Gemini extracts claims and rates them as TRUE/FALSE/UNCERTAIN

### Verifier 4 — NewsAPI Corroboration (Weight: 2–5%)

Searches NewsAPI for news articles covering the same topic/keywords.

- Counts how many **trusted sources** (BBC, Reuters, NDTV, etc.) cover the story
- Score logic:
  - 3+ trusted sources → `80` (strong corroboration)
  - 2 trusted sources → `65`
  - 1 trusted source → `52`
  - Zero coverage → `25` (suspicious)

### Verifier 5 — Domain Reputation (Weight: 25%, Articles only)

Checks the source URL against a curated database of ~200 domains.

| Category | Score | Examples |
|----------|-------|---------|
| Tier 1 Trusted | 92 | BBC, Reuters, The Hindu, NDTV |
| Tier 2 Reputable | 68 | HuffPost, FoxNews, OpIndia |
| Known Fake Sites | 8 | NaturalNews, InfoWars, PostCard.news |
| Government/EDU | 82 | `.gov`, `.edu`, `.ac.in` |
| IP Address URL | 15 | Suspicious direct IP URLs |

### Composite Score Formula

**ARTICLE mode** (full weighted average):
```
Score = (Gemini×0.50) + (Domain×0.25) + (HuggingFace×0.13) + (FactCheck×0.10) + (News×0.02)
```

**CLAIM mode** (Gemini-dominant):
```
Score = (Gemini×0.80) + (FactCheck×0.15) + (News×0.05)
```

### Verdict Thresholds

| Score Range | Verdict | Label |
|-------------|---------|-------|
| 85–100 | `REAL` | ✅ Verified Real |
| 65–84 | `LIKELY_REAL` | 🟢 Likely Real |
| 40–64 | `UNCERTAIN` | 🟡 Uncertain |
| 20–39 | `LIKELY_FAKE` | 🟠 Likely Fake |
| 0–19 | `FAKE` | 🔴 Fake News |

### Real-Time Context Injection

For time-sensitive claims (cricket captaincy, political leaders, world records), the system:

1. **Detects** trigger keywords (e.g., "captain", "prime minister", "world cup")
2. **Queries NewsAPI** for the 5 most recent headlines on that topic
3. **Injects headlines** directly into the Gemini prompt BEFORE calling the model
4. Gemini then reasons from **live data** instead of potentially stale training knowledge

---

## 📡 API Reference

### Django Backend (`localhost:8000`)

#### Auth Endpoints (`/api/accounts/`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register/` | Create new account | ❌ |
| POST | `/login/` | Login with email/password | ❌ |
| POST | `/google/` | Google OAuth Sign-In | ❌ |
| POST | `/token/refresh/` | Refresh access token | ❌ |
| GET/PATCH | `/me/` | Get or update user profile | ✅ JWT |
| POST | `/forgot-password/` | Send OTP to email | ❌ |
| POST | `/verify-otp/` | Verify OTP code | ❌ |
| POST | `/reset-password/` | Set new password | ❌ |

#### News Endpoints (`/api/news/`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/analyze/` | Analyze text or URL | ✅ JWT |
| POST | `/analyze-image/` | Analyze uploaded image | ✅ JWT |

#### History Endpoints (`/api/history/`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List user's analysis history | ✅ JWT |
| GET | `/<id>/` | Get single analysis detail | ✅ JWT |
| DELETE | `/<id>/` | Delete an analysis | ✅ JWT |

---

### FastAPI ML Service (`localhost:8001`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/analyze` | Analyze text or URL |
| POST | `/analyze-image` | OCR + analyze image |

**POST `/analyze` Request:**
```json
{
  "text": "India won the cricket World Cup in 2023",
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "trust_score": 78,
  "verdict": "LIKELY_REAL",
  "verdict_label": "Likely Real",
  "reasoning": "...",
  "source_analysis": "...",
  "key_claims": ["..."],
  "red_flags": [],
  "gemini_score": 80,
  "hf_score": 72,
  "hf_label": "REAL",
  "fact_check_score": 65,
  "fact_checks": [],
  "news_score": 80,
  "news_sources": [...],
  "rd_score": 70,
  "rd_ai_generated": false,
  "sources_checked": ["Gemini AI", "HuggingFace NLP", "NewsAPI"]
}
```

---

## 🗄️ Database Schema

### `users` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-generated |
| `email` | VARCHAR (unique) | Login identifier |
| `full_name` | VARCHAR | Display name |
| `avatar_url` | URL | Profile picture (Google) |
| `google_id` | VARCHAR | Google OAuth sub ID |
| `is_active` | Boolean | Account status |
| `date_joined` | DateTime | Registration timestamp |

### `otp_verifications` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-generated |
| `user_id` | FK → users | Associated user |
| `otp_code` | VARCHAR(6) | 6-digit code |
| `created_at` | DateTime | Expiry reference (10 min) |

### `analysis_history` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-generated |
| `user_id` | FK → users | Owner |
| `input_text` | TEXT | Submitted content |
| `input_url` | URL | Source URL (optional) |
| `trust_score` | Integer | Final composite score (0-100) |
| `gemini_score` | Integer | Raw Gemini score |
| `verdict` | VARCHAR | REAL/LIKELY_REAL/etc. |
| `verdict_label` | VARCHAR | Human-readable verdict |
| `reasoning` | TEXT | AI explanation |
| `source_analysis` | TEXT | Source quality notes |
| `red_flags` | JSON | List of detected red flags |
| `key_claims` | JSON | Extracted key claims |
| `sources_checked` | JSON | Which verifiers ran |
| `input_mode` | VARCHAR | `claim` or `article` |
| `analyzed_at` | DateTime | Timestamp |

---

## 🔐 Authentication Flow

```
1. REGISTER
   User fills form → POST /api/accounts/register/
   → Django creates User, hashes password
   → Returns JWT access + refresh tokens
   → Frontend stores tokens in localStorage
   → User redirected to Dashboard

2. LOGIN (Email)
   POST /api/accounts/login/
   → Django validates credentials
   → Returns JWT tokens
   → AuthContext stores user state globally

3. GOOGLE SIGN-IN
   User clicks "Sign in with Google"
   → Google returns ID token (credential)
   → POST /api/accounts/google/ {credential}
   → Django verifies token via google-auth library
   → Creates or retrieves user account
   → Returns JWT tokens

4. TOKEN REFRESH
   Axios interceptor catches 401 responses
   → Automatically calls POST /token/refresh/
   → Updates access token silently
   → Retries original request

5. PASSWORD RESET
   POST /forgot-password/ → Django generates 6-digit OTP
   → Sends HTML email with styled OTP code
   → User enters OTP → POST /verify-otp/
   → If valid: POST /reset-password/ with new password
   → OTP deleted after use (prevents reuse)
```

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- pip & npm

### 1. Clone the Repository
```bash
git clone https://github.com/HARSHKDH/Fake-Newz-Detector-Website.git
cd "Fake Newz"
```

### 2. Setup Django Backend
```bash
cd trinetra_backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 3. Setup FastAPI ML Service
```bash
cd trinetra_ml
pip install -r requirements.txt
# Configure .env (see below)
uvicorn trinetra_ml.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. Setup React Frontend
```bash
cd trinetra_frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 🔑 Environment Variables

### `trinetra_backend/.env`
```env
SECRET_KEY=your-django-secret-key
DEBUG=True
GOOGLE_CLIENT_ID=your-google-oauth-client-id
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=Trinetra <your@gmail.com>
```

### `trinetra_ml/.env`
```env
GEMINI_API_KEY=your-gemini-api-key
HUGGINGFACE_API_KEY=your-huggingface-token
GOOGLE_FACT_CHECK_API_KEY=your-gcp-api-key
NEWS_API_KEY=your-newsapi-key
SAPLING_API_KEY=your-sapling-key   # Optional
```

### `trinetra_frontend/.env`
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_ML_BASE_URL=http://localhost:8001
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

---

## 👨‍💻 Author

**Harsh Khan** — [GitHub](https://github.com/HARSHKDH)

---

<div align="center">
  <i>Built with ❤️ to fight misinformation</i>
</div>