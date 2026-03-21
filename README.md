<<<<<<< HEAD
# Trinetra – Real-Time Fake News Detection Platform

## Architecture
- `trinetra_frontend/` – React + Vite + Tailwind CSS
- `trinetra_backend/` – Django REST Framework (Auth + News Proxy)
- `trinetra_ml/` – FastAPI (Gemini AI verification engine)

## Quick Start

### 1. Backend (Django)
```bash
cd trinetra_backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 2. ML Microservice (FastAPI)
```bash
cd trinetra_ml
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 3. Frontend (React)
```bash
cd trinetra_frontend
npm install
npm run dev
```

## Environment Variables
Copy `.env.example` to `.env` in each service folder and fill in your keys.
=======
# Fake-Newz-Detector-Website
Trinetra is a sophisticated, machine-learning-powered platform designed to combat the global epidemic of misinformation. In an era where "fake news" spreads six times faster than the truth, Trinetra acts as a real-time verification engine, empowering users to distinguish between credible journalism and fabricated propaganda.
>>>>>>> fe5e2228d9cab9c2a067f0c7a619b652082bf832
