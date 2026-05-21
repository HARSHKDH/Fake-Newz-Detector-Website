"""
Trinetra ML Microservice — FastAPI entry point.
Multi-source AI-powered news verification using Gemini, HuggingFace,
Google Fact Check, NewsAPI, and Reality Defender.
"""
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sys

# Ensure the parent directory is on sys.path so absolute imports work
_ML_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR = os.path.dirname(_ML_DIR)
if _ROOT_DIR not in sys.path:
    sys.path.insert(0, _ROOT_DIR)

from trinetra_ml.analyzer import analyze_content

app = FastAPI(
    title="Trinetra AI – Verification Engine",
    description="Multi-source fake news detection: Gemini · HuggingFace · Google Fact Check · NewsAPI · Reality Defender",
    version="2.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# allow_origins=["*"] lets the Vite dev-server (any port) reach FastAPI.
# allow_credentials must be False when using wildcard origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ─────────────────────────────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    text: Optional[str] = None
    url:  Optional[str] = None


class FactCheck(BaseModel):
    text:      str
    claimant:  str
    rating:    str
    publisher: str
    url:       str
    is_true:   bool
    is_false:  bool
    source:    Optional[str] = None   # 'Google Fact Check' or 'ClaimBuster'

    model_config = {'extra': 'allow'}  # tolerate any extra keys without crashing


class NewsSource(BaseModel):
    name:         str
    title:        str
    url:          str
    published_at: str


class AnalyzeResponse(BaseModel):
    # Core result
    trust_score:   int
    verdict:       str
    verdict_label: str
    reasoning:     str
    source_analysis: str
    key_claims:    List[str]
    red_flags:     List[str]
    # Per-source scores
    gemini_score:  Optional[int]  = None
    hf_score:      Optional[int]  = None
    hf_label:      Optional[str]  = None
    hf_available:  Optional[bool] = None
    fact_check_score:     Optional[int]  = None
    fact_checks:          Optional[List[FactCheck]] = []
    fact_check_count:     Optional[int]  = 0
    fact_check_available: Optional[bool] = None
    fact_check_source:    Optional[str]  = None   # which backend served the fact-checks
    news_score:    Optional[int]  = None
    news_sources:  Optional[List[NewsSource]] = []
    total_results: Optional[int]  = 0
    trusted_count: Optional[int]  = 0
    news_available: Optional[bool] = None
    rd_score:          Optional[int]  = None
    rd_available:      Optional[bool] = None
    rd_ai_generated:   Optional[bool] = None
    rd_ai_probability: Optional[int]  = None
    # Meta
    sources_checked: Optional[List[str]] = []
    input_mode:      Optional[str]       = None   # 'claim' | 'article'

    model_config = {'extra': 'allow'}  # tolerate future extra keys


@app.get("/")
async def root():
    return {
        "service": "Trinetra AI Verification Engine",
        "status": "online",
        "version": "2.0.0",
        "sources": ["Gemini AI", "HuggingFace NLP", "Google Fact Check", "NewsAPI", "Reality Defender"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    if not request.text and not request.url:
        raise HTTPException(status_code=422, detail="Provide either 'text' or 'url'.")

    result = await analyze_content(text=request.text, url=request.url)
    return result
