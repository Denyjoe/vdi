# Section 8: Admin System Settings

This plan outlines the implementation of the Admin System Settings module as requested in the user prompt. It gives the admin a dedicated page to configure system-wide rules and behaviors dynamically.

## Proposed Changes

### Backend

#### [MODIFY] [backend/apps/users/models.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/apps/users/models.py)
- **Action**: Add the `SystemSetting` model to store key-value configurations.
- **Details**: Model will contain `key`, `value`, `description`, `updated_by`, and `updated_at`. Include `@classmethod` helpers `get()` and `set()`. Run `makemigrations` and `migrate`.

#### [MODIFY] [backend/seed_data.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/seed_data.py)
- **Action**: Seed the database with the 13 default settings outlined (e.g. `max_vms_per_student`, `allow_student_registration`, `maintenance_mode`).

#### [MODIFY] [backend/apps/users/views.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/apps/users/views.py)
- **Action**: Add three API Views:
  - `SystemSettingsView` (GET, Admin only): Returns all settings as a dictionary.
  - `UpdateSystemSettingView` (PATCH, Admin only): Updates a specific setting by key.
  - `PublicSettingsView` (GET, AllowAny): Returns only non-sensitive settings (`institution_name`, `maintenance_mode`, etc.).

#### [NEW] [backend/apps/users/public_urls.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/apps/users/public_urls.py)
- **Action**: Expose `/api/settings/public/` using this new URL configuration file.

#### [MODIFY] [backend/apps/users/urls.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/apps/users/urls.py)
- **Action**: Wire `SystemSettingsView` to `/admin/settings/` and `UpdateSystemSettingView` to `/admin/settings/<str:key>/`.

#### [MODIFY] [backend/config/urls.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/config/urls.py)
- **Action**: Add `path('api/', include('apps.users.public_urls'))`.

#### [MODIFY] [backend/apps/vms/serializers.py](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/backend/apps/vms/serializers.py)
- **Action**: Update `VMRequestSerializer.validate()` to fetch `max_vms_per_student` from `SystemSetting` instead of hardcoding a limit of 1 active VM.

### Frontend

#### [NEW] [frontend/src/pages/admin/AdminSettingsPage.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/pages/admin/AdminSettingsPage.jsx)
- **Action**: Build the settings page UI with four specific configuration cards:
  - Institution Info
  - VM & Session Limits
  - Access Control
  - System Status
- Include individual "Save" actions for each card to prevent accidental mass-edits.
- Provide a Live Preview section showing exactly how students will see the updated configuration (e.g., system announcements and institution name).
- Provide an Academic Year Management section to list, filter, and add new `CourseStream` records.

#### [MODIFY] [frontend/src/components/layout/Sidebar.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/components/layout/Sidebar.jsx)
- **Action**: Add the `/admin/settings` route with a settings icon for Admins.

#### [MODIFY] [frontend/src/App.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/App.jsx)
- **Action**: Register the new route for `AdminSettingsPage`.

#### [MODIFY] [frontend/src/pages/student/StudentDashboard.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/pages/student/StudentDashboard.jsx) & [frontend/src/pages/lecturer/LecturerDashboard.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/pages/lecturer/LecturerDashboard.jsx)
- **Action**: On mount, fetch `/api/settings/public/`. Display the `system_announcement` in an amber banner if present.

#### [MODIFY] [frontend/src/pages/auth/LoginPage.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/pages/auth/LoginPage.jsx)
- **Action**: Fetch public settings on mount and use `institution_short_name` and `institution_name` dynamically.

#### [MODIFY] [frontend/src/components/auth/ProtectedRoute.jsx](file:///c:/Users/Denis%20Wilson/Desktop/dit-vdi-system/frontend/src/components/auth/ProtectedRoute.jsx)
- **Action**: Enforce `maintenance_mode` by checking public settings. If active, log out/block non-admin users.

## Verification Plan
1. **TEST A:** Send GET to `/api/admin/settings/` and verify the payload contains all 13 settings.
2. **TEST B:** Send PATCH to update `max_vms_per_student` and verify the change persists.
3. **TEST C:** Request `/api/settings/public/` without auth and verify only non-sensitive items are returned.
4. **TEST D:** Boot up frontend as Admin, navigate to Settings, update fields, save, and verify toasts.
5. **TEST E:** As a student, view the `system_announcement` banner and test the dynamic VM quota restrictions.
6. **TEST F:** Try adding a new CourseStream from the Academic Management table.

> [!IMPORTANT]
> Since this introduces a new database model, it is crucial to stop the backend server, run `makemigrations` and `migrate`, and run the updated `seed_data.py` script. These actions will be performed as part of the execution phase.
