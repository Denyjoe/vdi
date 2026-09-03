# Virtual Computing Lab and Remote Access

A cloud-based virtual desktop platform for universities in East Africa. Students and lecturers launch full Linux (and, increasingly, Windows) desktops from a browser, with no local hardware requirements, and per-hour or subscription billing through M-Pesa, Airtel Money, Tigo Pesa, and Halopesa via AzamPay.

![Django](https://img.shields.io/badge/Django-6.0-092E20?logo=django&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-database-4169E1?logo=postgresql&logoColor=white)
![Proxmox VE](https://img.shields.io/badge/Proxmox%20VE-hypervisor-E57000?logo=proxmox&logoColor=white)
![Guacamole](https://img.shields.io/badge/Apache%20Guacamole-remote%20desktop-D22128?logo=apache&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Live Demo

There's no public URL running right now, since the platform depends on a real Proxmox VE host and Guacamole instance that aren't exposed to the internet. A live walkthrough can be arranged on request, contact details are at the bottom of this README.

## Overview

Universities in East Africa routinely run into the same wall: coursework needs real computing power, things like CAD, engineering simulation, or a dedicated Linux environment for a systems course, while the lab has thirty aging machines and three hundred students. This platform exists to remove that constraint. A student signs in with Google or GitHub, picks a template, and is looking at a real, running desktop inside their browser within under a minute, with no VPN, no installed client, and no admin rights needed on a personal laptop.

The platform is built around three real user types with genuinely different needs. Students launch and use workspaces, join live sessions, and manage their own compute-hours balance. Lecturers run live, proctored sessions with network lockdown, clipboard/file-transfer restrictions, and broadcast messaging to an entire class roster (this works whether or not a session is even active), and they see real attendance and engagement data for their courses. University admins manage departments, courses, enrollment, and lecturer permissions for their own institution, without touching anyone else's. A platform-level super-admin layer sits above all of it, approving new university accounts and managing the shared VM/hardware pool those universities draw from.

None of this is simulated underneath. Workspace provisioning genuinely clones a VM from a Proxmox VE template, waits for a real IP over the QEMU guest agent, confirms the remote desktop service is actually listening, and wires up a real Apache Guacamole connection before handing control back to the browser. Billing runs through a real AzamPay integration (sandboxed during development, so nothing is ever actually charged) supporting the mobile money providers that matter in the region, rather than a generic Stripe-only checkout that assumes a credit card.

## Features

- **Workspace provisioning**: clone-from-template, boot, guest-agent IP detection, remote-desktop readiness check, and Guacamole connection setup, with a pre-warmed VM pool for near-instant assignment when one's available
- **Live session hosting**: host/participant roles, broadcast messaging, pause/resume control over participants, network lockdown with a domain whitelist (DNS-tunneling-safe), clipboard and file-transfer restriction toggles, exam mode with timed lockdown
- **University management layer**: departments, courses, enrollment (bulk CSV or self-enroll invite links), recurring class schedules, real attendance/engagement tracking, course-wide broadcast messaging independent of live sessions
- **Template wizard**: build a new Linux or Windows VM template from scratch through a guided flow, including OS install automation, software provisioning, and ISO management
- **Billing**: per-hour and monthly-subscription pricing per template, hours-balance tracking, AzamPay integration (M-Pesa, Airtel Money, Tigo Pesa, Halopesa)
- **Security-hardened by design, not by afterthought**: outbound firewall rules scoped to resolved IPs (not open port 53, which is a DNS-tunneling bypass), JWT-only auth with no exposed password endpoint, Proxmox resource naming sanitized against injection, rate-limited sensitive actions

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 6 + Django REST Framework |
| Frontend | React 19 + Vite + Tailwind CSS |
| Database | PostgreSQL |
| Real-time | Django Channels (ASGI/Daphne) |
| Background tasks | Celery + Redis |
| Virtualization | Proxmox VE |
| Remote desktop | Apache Guacamole |
| Payments | AzamPay (M-Pesa, Airtel Money, Tigo Pesa, Halopesa) |
| Auth | Firebase (Google / GitHub OAuth) + JWT |

## Architecture

Four tiers. A React single-page app talks to a Django REST API over HTTPS and WebSockets. The API is the only thing that ever talks to Proxmox VE (to provision, start, and stop VMs) and to Guacamole's own REST API (to create the RDP/SSH connection a session actually streams over). PostgreSQL holds everything else: users, universities, sessions, billing. The browser never talks to Proxmox or Guacamole directly except through Guacamole's own tunnel, embedded same-origin behind the Django app.

```
┌──────────────┐        ┌───────────────────────┐        ┌──────────────┐
│ React (Vite) │ ─────▶ │ Django REST Framework  │ ─────▶ │ PostgreSQL   │
│ SPA frontend │ ◀───── │  - Auth (Firebase/JWT) │ ◀───── │              │
└──────────────┘        │  - Workspace/session   │        └──────────────┘
       │                │    orchestration       │
       │  Guacamole     │  - Billing (AzamPay)   │        ┌──────────────┐
       │  tunnel        │  - University layer    │ ─────▶ │ Proxmox VE   │
       └───────────────▶│                        │        │ (hypervisor) │
                         └───────────┬────────────┘        └──────────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │ Apache Guacamole       │
                         │ (RDP/SSH gateway)      │
                         └───────────────────────┘
```

## Getting Started

You'll need Python 3.12+, Node 18+, PostgreSQL, and Redis running locally. A real Proxmox VE host and Guacamole instance are required for actual VM provisioning to work. Without them the app runs, but launching a workspace will fail at the provisioning step.

```bash
git clone https://github.com/Denyjoe/vdi.git
cd vdi
```

**Backend**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # or: source venv/bin/activate on Linux/macOS
pip install -r requirements.txt

cp .env.example .env
# fill in DB_*, PROXMOX_*, SECRET_KEY, etc. in .env

python manage.py migrate
python manage.py runserver
```

**Frontend**

```bash
cd frontend
npm install

cp .env.example .env.development
# fill in VITE_FIREBASE_* from your Firebase project

npm run dev
```

**Background workers** (for notifications, scheduled cleanup)

```bash
cd backend
celery -A config worker --loglevel=info --pool=solo   # Windows
celery -A config worker --loglevel=info --concurrency=4   # Linux/macOS
```

## Project Structure

```
backend/
  apps/
    users/         accounts, auth, admin actions, API tokens
    university/    departments, courses, enrollment, lecturer/admin views
    vms/            VM templates, provisioning, pooling, template wizard
    sessions/       live session hosting, broadcast, restrictions
    notifications/  real-time notification delivery
    billing/        AzamPay integration, hours balance, subscriptions
    assignments/    coursework submission
  config/           Django settings, URLs, ASGI/WSGI entrypoints

frontend/
  src/
    pages/
      admin/        platform-admin dashboard, template wizard, hardware
      university/   university-admin and lecturer dashboards
      member/       student-facing workspace/session pages
      public/       landing page, templates catalogue
    components/     shared UI (Guacamole embed, toasts, modals)
    store/          Zustand state (auth, theme, context)
    services/       API client

docs/
  USER_MANUAL.md    end-user guide for students, lecturers, and admins
```

## Testing

The backend has 295 real tests under `backend/apps/`, covering university/course lifecycle, enrollment paths, lecturer broadcast scoping, attendance calculation, template provisioning, and VM ID allocation. A full run currently passes all but one: `WorkspaceIdleCleanupTests.test_30_days_idle_triggers_real_deletion` deliberately clones a real Proxmox VM to verify idle-cleanup deletion, so it fails whenever the configured Proxmox host isn't reachable. That's an environment dependency, not a code defect.

```bash
cd backend
python manage.py test apps
```

That one test aside, expect the `apps/vms` module in general to run slower than the rest, since several tests there talk to a real Proxmox host rather than a mock.

Frontend build verification:

```bash
cd frontend
npm run build
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, PR process, and code style. Please review the [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## License

MIT. See [LICENSE](LICENSE).

## Documentation

The full end-user guide, covering sign-up, launching a workspace, hosting or joining a live session, and university-admin functions, is in [docs/USER_MANUAL.md](docs/USER_MANUAL.md).

## Author

Denis Wilson, [@Denyjoe](https://github.com/Denyjoe)

Phone: +255 782 183 406
