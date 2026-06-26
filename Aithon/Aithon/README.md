# Aithon — Multi-Agent Data Governance System

A production-ready multi-agent system for automated data pipeline management featuring **Task Planning** (NLP), **Data Contract Enforcement**, **Data Quality Governance**, and **Synthetic Data Generation**.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Dashboard (5173)                     │
│   Dashboard │ Upload │ Tasks │ Workflow │ Reports               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API (JWT)
┌──────────────────────────▼──────────────────────────────────────┐
│                   FastAPI Backend (8000)                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Auth   │  │   REST API   │  │  Orchestrator │              │
│  └──────────┘  └──────────────┘  └──────┬───────┘              │
│                                         │                       │
│  ┌─────────────────────────────────────▼────────────────────┐  │
│  │               DAG Engine (NetworkX)                       │  │
│  │  Task Planner → Contract → Quality → Synthetic Generator  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Scheduler│  │ Lineage  │  │  Audit   │  │   Celery     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└──────────────────────────┬───────────────────┬──────────────────┘
                           │                   │
                ┌──────────▼──┐         ┌──────▼──────┐
                │ PostgreSQL  │         │    Redis    │
                │   (5432)    │         │   (6379)    │
                └─────────────┘         └─────────────┘
```

## 🤖 Agents

| Agent | Purpose | Technologies |
|-------|---------|-------------|
| **Task Planner** | NLP intent classification + DAG generation | Keyword NLP (BERT stub) |
| **Contract Enforcement** | Schema validation, type checks, range constraints | Pydantic, JSON Schema |
| **Data Quality** | Missing value imputation, duplicate/outlier detection | scikit-learn KNNImputer |
| **Synthetic Generator** | Statistical data generation, PII masking | NumPy/Pandas (CTGAN/VAE stubs) |

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Clone and run
docker-compose up --build

# Access:
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# Swagger Docs: http://localhost:8000/docs
```

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Start PostgreSQL and Redis (via Docker or locally)
docker run -d --name pg -e POSTGRES_DB=aithon_db -e POSTGRES_USER=aithon -e POSTGRES_PASSWORD=aithon_secret -p 5432:5432 postgres:16-alpine
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Run backend
uvicorn main:app --reload --port 8000

# Run Celery worker (separate terminal)
celery -A core.celery_app worker --loglevel=info
```

**Frontend:**
```bash
cd Aithon
npm install
npm run dev
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login (returns JWT) |
| GET | `/auth/me` | Current user |
| POST | `/task/create` | Submit NLP task |
| POST | `/dataset/upload` | Upload CSV/JSON |
| GET | `/task/{id}/status` | Task + DAG status |
| GET | `/task/{id}/lineage` | Data lineage |
| GET | `/task/{id}/report` | Reports |
| GET | `/dashboard/metrics` | Dashboard stats |
| GET | `/datasets` | List datasets |
| GET | `/reports/{id}/download` | Download file |

Full Swagger docs at `http://localhost:8000/docs`

## 🧪 Testing

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

## 📁 Project Structure

```
Aithon/
├── backend/
│   ├── agents/          # 4 AI agents
│   ├── core/            # DAG engine, scheduler, orchestrator
│   ├── api/             # REST routes + auth
│   ├── models/          # SQLAlchemy models
│   ├── utils/           # Logging, lineage
│   ├── tests/           # Unit + integration tests
│   ├── test_data/       # Sample datasets
│   └── main.py          # FastAPI entry point
├── Aithon/              # React frontend
│   ├── src/
│   │   ├── components/  # Sidebar
│   │   ├── context/     # Auth context
│   │   ├── pages/       # All dashboard pages
│   │   ├── services/    # API layer
│   │   └── App.jsx      # Router + layout
│   └── index.html
├── docker-compose.yml
└── .env.example
```

## 🔒 Security

- JWT token authentication
- Password hashing (bcrypt)
- CORS configuration
- PII detection and masking
- Dataset encryption support (TLS-ready)

## 📝 License

MIT
