# DIT Virtual Desktop Infrastructure (VDI) System
### Project Plan — Web Application Build

**Student:** Denis John Wilson
**Registration Number:** 230242498947
**Class:** BENG22 COE - 2
**Supervisor:** Mr. Shija
**Institution:** Dar es Salaam Institute of Technology (DIT)

---

## 1. Project Summary

A centralized, web-based Virtual Desktop Infrastructure (VDI) system that lets DIT students and lecturers access high-performance virtual computing environments remotely through any browser, removing the need for expensive local hardware to run resource-intensive software (AutoCAD, MATLAB, Photoshop, Revit, etc.).

**Problem being solved:** Most students own low-spec laptops that cannot run the software their coursework requires. Physical computer labs have limited capacity, fixed hours, no remote access, and are hard to supervise during practical exams.

**Solution:** A platform with four integrated subsystems:
1. Virtual machine allocation and management
2. Web-based remote access to those VMs
3. Lecturer monitoring and session control
4. Centralized file sharing and assignment submission

---

## 2. Build Scope & Assumptions

- **Build type:** Full working web application demonstrating all four subsystems end-to-end.
- **VM provisioning & remote sessions:** Simulated in software (no real Proxmox or Guacamole server required to demo). The orchestration logic is isolated behind clean interfaces so a real Proxmox/Guacamole backend can be connected later without touching the rest of the app.
- **Stack:** React (frontend) + Node.js/Express (backend) + PostgreSQL (database).
- **Purpose:** Final year project submission/demo — needs to look and behave like a complete, professional system during a live demo or video walkthrough.

*(If any of these assumptions are wrong, update this section before Phase 0 — everything else is built on top of it.)*

---

## 3. System Architecture

```
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

**Key design rule:** all VM-provisioning calls and all remote-desktop-session calls go through two dedicated service modules (`vmOrchestrator` and `remoteSessionManager`). Everything else in the app talks to those modules, never to "Proxmox" or "Guacamole" directly. That's what makes a future swap to real infrastructure a contained change.

---

## 4. Core Data Entities

| Entity | Key Fields | Notes |
|---|---|---|
| User | id, name, email, passwordHash, role | role = student / lecturer / admin |
| Class | id, name, lecturerId | groups students for materials/assignments |
| ClassEnrollment | classId, studentId | many-to-many |
| VMTemplate | id, name, specs (CPU/RAM/GPU), software list | e.g. "AutoCAD Workstation" |
| VirtualMachine | id, templateId, ownerId, status, allocatedAt | status: provisioning / running / stopped |
| RemoteSession | id, vmId, userId, startedAt, endedAt, status | tracks connect/disconnect |
| ExamSession | id, classId, lecturerId, startedAt, endedAt, restrictions | exam-mode session control |
| File | id, classId, uploaderId, filename, path, uploadedAt | lecturer-distributed materials |
| Assignment | id, classId, title, description, dueDate | created by lecturer |
| Submission | id, assignmentId, studentId, filePath, submittedAt | student submissions |
| ActivityLog | id, userId, action, timestamp, metadata | for monitoring/audit trail |

---

## 5. Software Requirements Summary (from SRS)

**Functional modules:**
- **Authentication** — registration, login/logout, role-based access (student/lecturer/admin), session management
- **VM Management** — allocate/start/stop VMs, monitor status, dynamic resource assignment
- **Remote Access** — browser-based VM access, simulated desktop streaming, session connectivity tracking
- **Lecturer Monitoring** — view active sessions, restrict/control activity during practical exams, session logs
- **File Sharing & Assignments** — upload/share files per class, assignment submission, storage of submitted work

**Non-functional requirements:**
- Support multiple concurrent users
- Reasonable VM allocation response time
- Authenticated access only; isolated user sessions
- Accessible via standard browsers, local network or internet
- User-friendly interface requiring minimal technical skill
- Designed to scale (more VMs/users/software without redesign)
- Stable sessions; logged failures; securely stored files

---

## 6. Build Phases

### Phase 0 — Foundation
**Goal:** Project skeleton and data layer in place, nothing user-facing yet.
- Initialize repo structure (frontend/, backend/, shared docs)
- Set up Express server, PostgreSQL connection, environment config
- Define and migrate database schema for all entities in Section 4
- Set up React app shell with routing skeleton
- **Done when:** backend boots, connects to DB, and a health-check endpoint responds; frontend boots to a blank shell.

### Phase 1 — Authentication & User Management
**Goal:** Anyone can register, log in, and land on a role-appropriate dashboard.
- Registration & login endpoints, password hashing
- Role-based access control middleware (student/lecturer/admin)
- JWT or session-based auth
- Frontend: login/register pages, protected routes, role-specific dashboard shells
- **Done when:** all three roles can register, log in, log out, and see their own (empty) dashboard.

### Phase 2 — Virtual Machine Allocation Subsystem *(Objective I)*
**Goal:** Students can request and manage a virtual machine.
- VM template catalog (seeded: AutoCAD Workstation, MATLAB Lab, Programming Environment, etc.)
- Request → simulated provisioning → running/stopped status lifecycle
- Resource usage display (simulated CPU/RAM stats)
- Admin view: VM pool overview, manually stop/reassign VMs
- **Done when:** a student can browse templates, request a VM, watch it provision, and see it listed as running.

### Phase 3 — Web-Based Remote Access Subsystem *(Objective II)*
**Goal:** A simulated "remote desktop" experience inside the browser.
- `remoteSessionManager` module: connect/disconnect logic, session timers, status tracking
- Frontend: simulated desktop viewport for an allocated VM, connect/reconnect/disconnect controls
- Session history per user
- **Done when:** a student can click "Connect" on a running VM, see a simulated session screen, disconnect, and reconnect.

### Phase 4 — Lecturer Monitoring & Session Control *(Objective III)*
**Goal:** Lecturers can supervise active sessions, especially during exams.
- Lecturer dashboard: live list of active student sessions per class
- Lock / restrict / terminate a student's session
- Exam-mode session with defined start/end and restrictions
- Session activity logs (who connected, when, for how long)
- **Done when:** a lecturer can see students currently connected, terminate one, and view a session log afterward.

### Phase 5 — File Sharing & Assignment Submission *(Objective IV)*
**Goal:** Lecturers distribute materials; students submit work.
- Lecturer: upload files to a class, create assignments with due dates
- Student: download class files, submit assignment files before deadline
- Lecturer: view submissions per assignment/student
- **Done when:** a lecturer posts an assignment and material, a student submits a file, and the lecturer sees it.

### Phase 6 — Analytics / Reporting Dashboard
**Goal:** Surface the kind of data your literature/data-analysis chapter already collected.
- Dashboard charts: laptop capability distribution, demand for remote access, exam supervision challenges (using the percentages from your data analysis slides as seed/demo data)
- Ties the live system back to the research justification in your report
- **Done when:** an admin/lecturer view shows these charts populated with data.

### Phase 7 — Polish & Packaging
**Goal:** Demo- and defense-ready.
- DIT branding (colors, logo, consistent UI)
- Responsive layout pass
- Basic automated tests for core flows (auth, VM request, file submission)
- README with setup instructions + architecture diagram matching this plan
- Decide: run locally for defense, or deploy (e.g. Render/Railway/VPS) for a live demo link
- **Done when:** the whole flow — register → request VM → connect → get monitored → submit assignment — can be demoed start to finish without errors.

---

## 7. Suggested Folder Structure

```
dit-vdi-system/
├── PROJECT_PLAN.md
├── backend/
│   ├── src/
│   │   ├── config/          # db connection, env config
│   │   ├── models/          # DB models (User, VM, Session, etc.)
│   │   ├── routes/          # API route handlers
│   │   ├── services/
│   │   │   ├── vmOrchestrator.js
│   │   │   └── remoteSessionManager.js
│   │   ├── middleware/      # auth, role checks
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/            # Login, StudentDashboard, LecturerDashboard, AdminDashboard
│   │   ├── components/
│   │   ├── services/         # API calls
│   │   └── App.jsx
│   └── package.json
└── docs/
    └── architecture-diagram.png
```

---

## 8. Working Process

1. We tackle one phase at a time, in order — no skipping ahead.
2. Each phase ends with something clickable/testable before moving on.
3. Claude Code proposes changes as a diff; review before accepting.
4. After each phase, update this file's checklist (below) so progress is tracked across sessions.

### Phase Checklist
- [x] Phase 0 — Foundation
- [x] Phase 1 — Authentication & User Management
- [x] Phase 2 — VM Allocation Subsystem
- [x] Phase 3 — Web-Based Remote Access
- [x] Phase 4 — Lecturer Monitoring & Session Control
- [ ] Phase 5 — File Sharing & Assignment Submission
- [ ] Phase 6 — Analytics / Reporting Dashboard
- [ ] Phase 7 — Polish & Packaging 
 