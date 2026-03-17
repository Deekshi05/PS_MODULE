## Purchase & Store Module (WF-PS-001)

Django + DRF backend + React frontend implementing:
- **Indent submission** by authenticated employee
- **Stock check** against `CurrentStock`
- **Department routing** to the correct HOD via `HoldsDesignation`
- **Strict RBAC** using an acting role header (`X-Acting-Role`)

### Backend (Django)

Create env file:
- Copy `backend/.env.example` to `backend/.env`
- If you don’t set `POSTGRES_DB`, it will fall back to SQLite (`backend/db.sqlite3`)

Run:

```bash
cd backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py seed_demo
..\.venv\Scripts\python manage.py createsuperuser
..\.venv\Scripts\python manage.py runserver
```

Auth:
- Get JWT: `POST /ps/api/auth/token/`
- Use: `Authorization: Bearer <access>`

### Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Optional env:
- Create `frontend/.env` with:

```bash
VITE_API_BASE=http://127.0.0.1:8000
```

### RBAC (acting role)

All `/ps/api/*` endpoints require:
- JWT auth
- `X-Acting-Role: EMPLOYEE` or `X-Acting-Role: HOD`

Server-side checks:
- **EMPLOYEE**: can create indents and view only their own
- **HOD**: must have an active `HoldsDesignation` whose `designation.name` contains `hod`; can view only department indents and take actions

### Key endpoints

- `POST /ps/api/indents/` (EMPLOYEE) submit indent (auto-assign indenter + department, stock check, route to HOD)
- `GET /ps/api/indents/` (EMPLOYEE/HOD) list indents (RBAC filtered)
- `POST /ps/api/indents/{id}/hod-action/` (HOD) approve/reject/forward

