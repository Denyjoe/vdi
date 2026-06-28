# DIT VDI System
## Virtual Desktop Infrastructure for Dar es Salaam Institute of Technology

### Overview
A centralized, web-based Virtual Desktop Infrastructure (VDI) system designed for the Dar es Salaam Institute of Technology (DIT). This platform allows students and lecturers to access high-performance virtual computing environments remotely through any standard web browser, eliminating the need for expensive local hardware to run resource-intensive coursework software like AutoCAD, MATLAB, and Revit.

### Student
Denis John Wilson  
Registration: 230242498947  
Supervisor: Mr. Shija  
Institution: DIT — BENG22 COE-2  

### System Architecture
```text
┌─────────────────┐      ┌──────────────────────┐      ┌──────────────┐
│   React Frontend │ ───▶ │  Express REST API     │ ───▶ │ PostgreSQL   │
│ (Student/Lecturer/│ ◀── │  - Auth & RBAC         │ ◀── │ Database     │
│  Admin dashboards)│      │  - VM Orchestration*   │      └──────────────┘
└─────────────────┘      │  - Remote Session Mgr* │
                          │  - File/Assignment Mgr │
                          │  - Monitoring/Logs     │
                          └──────────────────────┘
                                    │
                       ┌────────────┴────────────┐
                       │   Simulation Layer        │
                       │  (stands in for Proxmox    │
                       │   API + Guacamole today;   │
                       │   swappable later)         │
                       └────────────────────────────┘
```

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Django 5 + Django REST Framework |
| Database | PostgreSQL |
| Auth | JWT (djangorestframework-simplejwt) |
| Real-time | Django Channels + WebSocket |
| Charts | Recharts |
| Icons | Lucide React |
| Celery | Background task queue |
| Redis | Message broker (production) |
| VM Layer | Proxmox VE (simulation in dev) |

### Features
* **Authentication:** Secure registration, login, and role-based dashboards (Admin, Lecturer, Student).
* **Virtual Machine Management:** Users can request VMs from templates. The system handles simulated provisioning, dynamic resource assignment, and state management (start/stop).
* **Remote Access:** Browser-based simulated desktop session streaming with connectivity tracking and duration logging.
* **Lecturer Monitoring & Exams:** Lecturers can view active student sessions, supervise lab activity, and run exam-mode sessions with strict time controls and activity logs.
* **File Sharing & Assignments:** Centralized file distribution for classes and structured assignment submission tracking with automated late-flagging.
* **Analytics Dashboard:** Admins have full visibility into system usage, user roles, VM allocation, and chronological activity logs.

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd dit-vdi-system
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   
   # Set up environment variables
   cp .env.example .env 
   # (Configure DB settings in .env)
   
   python manage.py migrate
   python manage.py runserver
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Running Background Tasks**
   
   For development (Windows):
   ```bash
   cd backend
   .\venv\Scripts\celery -A config worker --loglevel=info --pool=solo
   ```
   
   For production (Linux):
   ```bash
   celery -A config worker --loglevel=info --concurrency=4
   celery -A config beat --loglevel=info
   ```

5. **Production Build:**
   ```bash
   cd frontend
   npm run build
   ```

### User Roles
| Role | Capabilities |
|---|---|
| **Student** | Request VMs, connect to desktop sessions, download class materials, submit assignments. |
| **Lecturer** | Manage class enrollments, upload materials, create assignments, grade submissions, monitor active student VM sessions. |
| **Admin** | Full system visibility, manage users (activate/deactivate), monitor system health, view raw activity logs, and oversee all VMs. |

### Phase Completion
- [x] Phase 0 — Foundation
- [x] Phase 1 — Authentication & User Management
- [x] Phase 2 — VM Allocation Subsystem
- [x] Phase 3 — Web-Based Remote Access
- [x] Phase 4 — Lecturer Monitoring & Session Control
- [x] Phase 5 — File Sharing & Assignment Submission
- [x] Phase 6 — Analytics / Reporting Dashboard
- [x] Phase 7 — Polish & Packaging
