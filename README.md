# TextileAI ERP

An AI-powered ERP system for textile spinning mills. Built with FastAPI, React, PostgreSQL, scikit-learn, and a Q-Learning RL optimizer.

## Live Demo

| Service | URL |
|---|---|
| Frontend | https://textileai-erp-seven.vercel.app |
| Backend API | https://textileai-erp-production-9e0b.up.railway.app |
| API Docs | https://textileai-erp-production-9e0b.up.railway.app/docs |

**Default login:** `admin` / `admin123`

---

## Features

- **Production Planning** — Calculate yarn output using spinning mill formulas (spindle speed, TPI, efficiency)
- **Raw Material Management** — Cotton stock tracking, bale requirement calculator, IN/OUT transactions
- **Waste Monitoring** — Log and track waste % per process stage (Blowroom → Winding), alert system
- **AI Prediction** — ML models (Random Forest + Linear Regression) for production and waste forecasting
- **7-Day Forecast** — Production forecast chart with confidence intervals
- **RL Optimizer** — Q-Learning agent that suggests optimal machine settings to reduce waste and increase output
- **Dashboard** — Live KPIs, waste alerts, stock status, model performance

---

## Tech Stack

### Backend
| Package | Purpose |
|---|---|
| FastAPI | REST API framework |
| SQLAlchemy | ORM |
| PostgreSQL (Aiven) | Database |
| psycopg2-binary | PostgreSQL driver |
| scikit-learn | ML models (RandomForest, LinearRegression) |
| joblib | Model serialization |
| python-jose | JWT authentication |
| bcrypt | Password hashing |
| uvicorn | ASGI server |

### Frontend
| Package | Purpose |
|---|---|
| React 18 | UI framework |
| lucide-react | Icons |
| Tailwind CSS | Utility styles |
| react-scripts | Build tooling |

---

## Project Structure

```
textileai-erp/
├── backend/
│   ├── app/
│   │   ├── routers/          # API endpoints (auth, production, waste, prediction, optimize)
│   │   ├── rl/               # Q-Learning agent, environment, training script
│   │   ├── models_trained/   # Saved .pkl ML models (gitignored)
│   │   ├── auth.py           # JWT auth helpers
│   │   ├── calculations.py   # Spinning mill formula logic
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── database.py       # SQLAlchemy engine + session
│   │   ├── ml_model.py       # ML model loader + prediction functions
│   │   ├── auto_logger.py    # Synthetic waste log generator
│   │   ├── models.py         # DB models
│   │   └── schemas.py        # Pydantic request/response schemas
│   ├── main.py               # FastAPI app + CORS + router registration
│   ├── seed.py               # DB seed script (creates tables + admin user)
│   ├── train_model.py        # ML training script
│   ├── Dockerfile            # Docker config for Railway
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── api/api.js        # Centralised API client
│   │   ├── components/       # Layout, OptimizerWidget
│   │   └── pages/            # Dashboard, ProductionPlanning, RawMaterial, WasteMonitoring, Prediction, Login
│   ├── .env.development      # Local API URL
│   └── .env.production       # Production API URL
└── README.md
```

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL database (or use Aiven free tier)

### Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and fill in DATABASE_URL and SECRET_KEY

# Create tables and seed admin user
python seed.py

# Start server
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

### Frontend setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`

### Train ML models (optional)

```bash
cd backend

# Generate synthetic training data (30 days)
python -c "from app.auto_logger import generate_history; generate_history(30)"

# Train RandomForest + LinearRegression models
python train_model.py
```

---

## Environment Variables

### Backend `.env`

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SECRET_KEY=your-random-secret-key-at-least-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app
```

### Frontend `.env.production`

```env
REACT_APP_API_BASE=https://your-backend.up.railway.app
```

---

## Deployment

### Backend — Railway
1. Connect GitHub repo to Railway
2. Set Root Directory to `backend`
3. Set Builder to `Dockerfile`
4. Add environment variables (DATABASE_URL, SECRET_KEY, etc.)
5. Generate domain → port 8000
6. Run `python seed.py` in Railway Console after first deploy

### Frontend — Vercel
1. Connect GitHub repo to Vercel
2. Set Root Directory to `frontend`
3. Add environment variable: `REACT_APP_API_BASE=https://your-railway-url`
4. Deploy

---

## ML Model Details

| Model | Target | Features | Algorithm |
|---|---|---|---|
| Production | kg/day | spindle_speed, efficiency, waste_pct, temp, humidity, hour, nominal_count | RandomForest |
| Waste | waste % | temp, humidity, spindle_speed, efficiency, stage_id, shift_id, input_kg | RandomForest |

Models fall back to physics-based rule calculations if `.pkl` files are not found.

### RL Optimizer
- Algorithm: Q-Learning (tabular)
- State: [temp, humidity, speed, efficiency, stage, hour]
- Actions: Increase/Decrease Speed, Humidity, Efficiency (6 actions)
- Reward: waste reduction × 2.5 + production gain × 0.7

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT token |
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/production/yarn-counts` | List yarn counts |
| POST | `/api/production/calculate` | Quick spinning calculation |
| POST | `/api/production/plans` | Save production plan |
| GET | `/api/raw-material/inventory` | List inventory |
| POST | `/api/raw-material/transaction` | Add stock IN/OUT |
| POST | `/api/waste/log` | Log waste entry |
| GET | `/api/waste/summary` | Waste summary stats |
| POST | `/api/prediction/production` | Predict production kg |
| POST | `/api/prediction/waste` | Predict waste % |
| GET | `/api/prediction/forecast/7day` | 7-day forecast |
| POST | `/api/prediction/train` | Trigger model training |
| POST | `/api/optimize` | RL optimizer suggestion |

Full interactive docs at `/docs`.

---

## Process Waste Limits

| Stage | Normal Limit |
|---|---|
| Blowroom | 1.2% |
| Carding | 4.5% |
| Combing | 14.0% |
| Drawing | 0.5% |
| Roving | 0.8% |
| Spinning | 3.25% |
| Winding | 0.5% |
