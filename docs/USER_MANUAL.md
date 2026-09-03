# Virtual Computing Lab and Remote Access: User Manual

This covers how to actually use the platform, day to day, as a student, a lecturer, or a university admin. It doesn't cover deployment or code. See the main [README](../README.md) for that.

## Signing in

Sign-in uses Google or GitHub, so there's no separate password to create or remember. From the landing page, click **Sign In**, then **Continue with Google** or **Continue with GitHub**. Your university admin (or the platform admin, for a personal account) is responsible for granting you the right role and course access after your first sign-in.

## For students

### Launching a workspace

1. Go to **My Workspaces** from the sidebar.
2. Click **New Workspace**, give it a name, and pick a template (a desktop environment like Ubuntu or Zorin, or a headless server template).
3. Click **Create & Launch**. If the template isn't free and you don't have hours or a subscription for it, you'll be prompted to buy hours or subscribe first. This is a real payment flow (M-Pesa, Airtel Money, Tigo Pesa, or Halopesa via AzamPay), sandboxed in development so nothing is actually charged.
4. Provisioning takes under a minute when a pre-warmed VM is available, longer (several minutes) if one has to be cloned fresh. You'll see live status updates: cloning, waiting for network, waiting for the remote desktop service.
5. Once it's running, click **Stream Desktop** to open the full remote desktop in your browser.

### Inside a workspace

- Use the toolbar to toggle fullscreen, open the on-screen keyboard (useful on mobile/tablet), or adjust zoom.
- Copy/paste between your device and the remote desktop works when the session's clipboard restriction isn't enabled.
- **Shut down** when you're done. This stops billing for that workspace (if it's on the hours-balance plan) and frees the VM.

### Joining a live session

If a lecturer or another student is hosting a session, you'll get an invite code or link. Go to **My Sessions**, enter the code under **Join a Session**, or open the invite link directly. Once inside, the host may pause your control at any time (for demonstrations); you'll see a clear on-screen indicator when that happens.

### Your schedule and coursework

**My Schedule** shows the real recurring class times for every course you're enrolled in, along with your own attendance record for each: not just whether you were enrolled, but how many real sessions you attended and for how long.

## For lecturers

### Your courses

The **Lecturer Dashboard** lists every course you teach, with real enrollment counts and a roster you can open per course.

- **Start Class Session** launches a real, live proctored session tied to that course.
- **Message Class** sends a real notification to every enrolled student. This works whether or not a class session is currently active, so you can use it for "moved to Room 204" style announcements outside of class time.
- **Request Template** asks your university admin to provision a new VM template for the course (e.g. a specific software stack), pre-filled with your course's estimated specs.

### Hosting a session

Once a session is live, the host view shows every connected participant and their VM's real resource usage. You can:

- **Broadcast** a message to everyone currently connected. It shows up as a toast in their session view within a few seconds.
- **Pause / Resume** any participant's control, or all of them at once, without kicking them out of the session.
- Set restrictions when creating the session: network lockdown (block all internet except a whitelist of domains you specify), clipboard sync, file transfer, screen monitoring, and session recording.

## For university admins

Your dashboard is scoped to your own institution only. You never see another university's data.

- **Departments**: create departments and, within each, the courses that belong to it.
- **Courses**: assign a lecturer, set a recurring schedule, and (once approved) link a VM template.
- **Enrollment**: either bulk-enroll students from a CSV (columns: email, department_code, role, course_code), or generate a self-enroll invite link students can use themselves.
- **Grant/Revoke Lecturer**: give a user lecturer permissions for a whole department or a single course.
- **Analytics**: real department/course/lecturer counts, enrollment trend, and usage-by-department breakdown, not estimates.
- **Hardware & Performance**: how much of your university's allocated Proxmox quota (vCPU, RAM, storage) is actually in use.

## For the platform (super) admin

University sign-ups start as a request under **University Requests**, reviewed and approved (or rejected) by the platform admin before that university's admin gets access to anything. The platform admin also manages the shared VM pool, global templates, and platform-wide billing configuration (payment provider, supported methods, pricing) from **System Settings**.

## Getting help

If something looks broken rather than just unfamiliar, check [SECURITY.md](../SECURITY.md) if it's a security concern, or open an issue using the bug report template in this repository.
