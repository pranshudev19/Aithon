# AI-Powered Task Planner System

A real-time, multi-agent task management system that uses AI (Gemini/Claude) to intelligently decompose high-level goals into subtasks and assign them to developers based on their role and skills.

## Features
- **Role-Based Workflows**: Manager vs. Developer access via JWT HTTP-only cookies.
- **AI Decomposition**: Automatically breaks down broad goals into prioritized, skill-assigned subtasks.
- **Real-Time Sync**: Socket.IO powered bidirectional syncing for task creation, status updates, and code submissions.
- **In-Browser Code Editor**: Integrated Monaco Editor for developer code submissions.

## Tech Stack
- Frontend: React, Vite, Tailwind CSS, Monaco Editor, Socket.IO Client, Axios
- Backend: Node.js, Express, Socket.IO, PostgreSQL, JWT, BCrypt
- AI: Google Gemini API / Anthropic Claude API

## Local Setup

### 1. Database
Ensure you have a PostgreSQL database running.

### 2. Environment Variables
Create a `.env` file in the root `TaskPlanner/` directory:

```env
OPENAI_API_KEY="your-gemini-or-openai-key-here"
ANTHROPIC_API_KEY="optional-claude-api-key"
JWT_SECRET="super-secret-taskplanner-key"
DATABASE_URL="postgresql://user:password@localhost:5432/your_db"
CORS_ORIGINS=["http://localhost:5173"]
CLIENT_ORIGIN="http://localhost:5173"
PORT=5000
```

### 3. Install Dependencies
In the backend:
```bash
cd server
npm install
```

In the frontend:
```bash
cd client
npm install
```

### 4. Database Seeding
This resets the database schema and creates users with different technical skills.

```bash
cd server
npm run seed
```

### 5. Start Servers
Backend Server (Port 5000):
```bash
cd server
npm run dev
```

Frontend App (Port 5173):
```bash
cd client
npm run dev
```

## Seeded Users

Manager: `manager@taskplanner.com` / `Manager@123`
Developer (Frontend): `alice@taskplanner.com` / `Dev@123`
Developer (Backend): `bob@taskplanner.com` / `Dev@123`
Developer (DevOps): `carol@taskplanner.com` / `Dev@123`
