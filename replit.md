# GradeUp AI

An AI-powered educational platform for students in grades 9–12. Includes an interactive learning frontend, Node.js backend API, admin dashboard, and a Python AI extraction pipeline.

## Project Structure

- **`react/`** — Main student frontend (Vite + React + TypeScript, port 5000)
- **`server/`** — Node.js/Express backend API (port 8000)
- **`admin/`** — Admin dashboard (Vite + React, port 5174)
- **`python/`** — FastAPI AI extraction pipeline (port 7000)

## Running the App

The main frontend workflow (`Start application`) runs the Vite dev server at port 5000.

To start the backend server:
```bash
cd server && node app.js
```

To start the admin dashboard:
```bash
cd admin && node_modules/.bin/vite
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI, Framer Motion, Vite
- **Backend**: Node.js, Express v5, Mongoose, JWT auth
- **Database**: MongoDB (via `MONGODB_URI` env var), Qdrant vector DB
- **AI Features**: OpenAI GPT-4, LiveKit real-time audio/video, FastAPI
- **Storage**: AWS S3 (optional)

## Environment Variables

The backend (`server/.env`) needs:
- `MONGODB_URI` — MongoDB connection string
- `PORT` — Server port (default: 8000)
- `FE_URL` — Frontend URL for CORS
- `JWT_SECRET` — Secret for JWT tokens
- Any other service-specific keys (LiveKit, OpenAI, AWS, etc.)

The frontend (`react/.env`) uses:
- `VITE_API_BASE_URL` — Backend API base URL

## User Preferences

- Keep the project structure as-is (react/, server/, admin/, python/ directories)
