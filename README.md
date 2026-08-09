# AI Study Scheduler (StudyFlow)

A smart study planning web app built with Flask. Plan subjects, set your daily
availability, and let the scheduler generate a smart timetable based on
difficulty, priority, and exam urgency. Track your streak, earn badges, and
review your study history.

## Features

- Register / login with secure password hashing (Flask-Login)
- Add, edit, and delete subjects (difficulty, priority, exam date, hours)
- Set daily study availability (hours + time window + energy level)
- Smart daily timetable generation with automatic regeneration
- Mark sessions complete and watch today's progress bar
- Weekly progress chart
- Insights: current/longest streak, sessions done, total hours
- 8 achievement badges (earned / locked)
- Full study history grouped by day
- Dark / light theme, fully responsive on mobile and laptop

## Tech Stack

- Python 3.13, Flask 3
- Flask-SQLAlchemy, Flask-Migrate (Alembic), Flask-Login
- Gunicorn (production server)
- Vanilla HTML/CSS/JS single-page app
- Works with SQLite locally and PostgreSQL in production

## Project Structure

```
app/
  __init__.py          # app factory (registers blueprints, ProxyFix)
  config.py            # config loaded from environment variables
  models.py            # User, Subject, DailyAvailability, Timetable
  auth/                # register / login / logout API
  subjects/            # subjects CRUD + progress API
  availability/        # availability API
  timetable/           # generate / today / history / weekly API
  dashboard/           # summary / profile / notifications / insights API
  scheduler/engine.py  # smart schedule algorithm
  static/              # styles.css + app.js
  templates/           # index.html (SPA)
migrations/            # Alembic migrations (create tables on deploy)
tests/                 # pytest suite
run.py                 # entry point: `app = create_app()`
Procfile               # Render/Heroku start command
render.yaml            # Render Blueprint (web + Postgres + migrations)
```

## Local Development

```bash
# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment (optional, defaults work locally)
copy .env.example .env          # Windows
cp .env.example .env            # macOS / Linux

# 4. Create the database tables
flask --app run db upgrade

# 5. Run the app
flask --app run run
# or
python run.py

# Open http://localhost:5000
```

### Run tests

```bash
pytest tests/ -q
```

## Environment Variables

| Variable              | Required | Default               | Description                                  |
| --------------------- | -------- | --------------------- | -------------------------------------------- |
| `SECRET_KEY`          | Yes (prod) | `my_secret_key`     | Flask secret key — set a random value in prod |
| `DATABASE_URL`        | No       | `sqlite:///database.db` | SQLAlchemy database URL (PostgreSQL in prod)  |
| `SESSION_COOKIE_SECURE` | No     | `false`               | Set to `true` when serving over HTTPS         |
| `FLASK_APP`           | No       | `run`                 | Flask CLI entry point                          |
| `FLASK_ENV`           | No       | `development`         | Set to `production` in prod                   |

## Deploy to GitHub

```bash
# From the project folder
git init
git add .
git commit -m "Initial commit"
git branch -M main

# Create a repository on GitHub, then push
git remote add origin https://github.com/<your-username>/ai-study-scheduler.git
git push -u origin main
```

> The `.gitignore` already excludes `.venv/`, `instance/`, `*.db`, `.env`, and
> `__pycache__`, so secrets and local databases never get committed.

## Deploy to Render

Render reads `render.yaml`, which sets everything up automatically:

- A **web service** (Python, Gunicorn) with `/health` as the health check
- A **managed PostgreSQL database** wired to `DATABASE_URL`
- **Migrations** (`flask --app run db upgrade`) run automatically before each deploy

Steps:

1. Push the project to GitHub (see above).
2. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
3. Connect your GitHub repo and click **Apply**.
4. Render creates the web service and database, runs migrations, and deploys.
5. Open the generated URL — you're live.

### Using a free external database instead of Render's managed Postgres

Render's managed Postgres is the easiest option but may incur costs. If you
want a free database (e.g. **Neon** or **Supabase** free tier):

1. Create a free Postgres project and copy its connection string.
2. In your Render web service → **Environment**, remove the `DATABASE_URL`
   value wired from the Blueprint database and paste the external URL instead.
3. You can also delete the `databases:` block from `render.yaml`.
4. Redeploy.

### Health check

The app exposes `GET /health`:

```json
{ "success": true, "status": "ok", "app": "AI Study Scheduler" }
```

## Deploying Elsewhere

Because the app is a standard WSGI Flask app, it runs on most platforms:

- **Railway / Fly.io** — same pattern: `gunicorn run:app`, set `DATABASE_URL`
  to a Postgres instance, run `flask --app run db upgrade` once.
- **PythonAnywhere** — import `run:app` into a WSGI file and use a MySQL/SQLite
  database.
- **Hugging Face Spaces** — select Docker/Python, requirements + `run:app`.

## Troubleshooting

- **500 errors after deploy** — check that migrations ran (`preDeployCommand`).
  In the Render dashboard, open the service → **Events** tab.
- **Logins don't persist** — make sure `SESSION_COOKIE_SECURE=true` is set
  (HTTPS) and the `SECRET_KEY` is stable between restarts.
- **Tables missing** — run `flask --app run db upgrade` manually against the
  production `DATABASE_URL`.
