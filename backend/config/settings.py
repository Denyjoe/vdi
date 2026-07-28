"""
Django settings for the DIT VDI System.

All secrets and environment-specific values are read from the .env
file via python-decouple. Never hardcode credentials here.

Reference: https://docs.djangoproject.com/en/stable/ref/settings/
"""

from pathlib import Path
from decouple import config, Csv
from datetime import timedelta

# ─────────────────────────────────────────────────────────────────────────────
# BASE PATHS
# ─────────────────────────────────────────────────────────────────────────────

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# ─────────────────────────────────────────────────────────────────────────────
# SECURITY & SITE INFO
# ─────────────────────────────────────────────────────────────────────────────

SITE_NAME = 'CloudDesk'
SITE_TAGLINE = 'Your workspace, anywhere'

SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost').split(',')


# ─────────────────────────────────────────────────────────────────────────────
# INSTALLED APPLICATIONS
# ─────────────────────────────────────────────────────────────────────────────

INSTALLED_APPS = [
    # Django    # Core
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'daphne',
    'django.contrib.staticfiles',

    # Third Party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',

    # Local Apps
    'apps.users',
    'apps.classes',
    'apps.assignments',
    'apps.sessions',
    'apps.vms',
    'apps.notifications',
    'apps.billing',
]


# ─────────────────────────────────────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────────────────────────────────────

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.users.middleware.MaintenanceModeMiddleware",
]

CORS_ALLOW_ALL_ORIGINS = True


# ─────────────────────────────────────────────────────────────────────────────
# URL & WSGI / ASGI CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"


# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATES
# ─────────────────────────────────────────────────────────────────────────────

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# DATABASE — PostgreSQL via psycopg2-binary
# ─────────────────────────────────────────────────────────────────────────────

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}


# ─────────────────────────────────────────────────────────────────────────────
# CUSTOM USER MODEL
# ─────────────────────────────────────────────────────────────────────────────

# Must be set before any migrations are created for the users app.
AUTH_USER_MODEL = "users.User"


# ─────────────────────────────────────────────────────────────────────────────
# PASSWORD VALIDATION
# ─────────────────────────────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ─────────────────────────────────────────────────────────────────────────────
# INTERNATIONALIZATION
# ─────────────────────────────────────────────────────────────────────────────

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Dar_es_Salaam"
USE_I18N = True
USE_TZ = True


# ─────────────────────────────────────────────────────────────────────────────
# STATIC & MEDIA FILES
# ─────────────────────────────────────────────────────────────────────────────

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# ─────────────────────────────────────────────────────────────────────────────
# DEFAULT PRIMARY KEY FIELD
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ─────────────────────────────────────────────────────────────────────────────
# CORS — Allow the React frontend to call this API
# ─────────────────────────────────────────────────────────────────────────────

CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", cast=Csv())


# ─────────────────────────────────────────────────────────────────────────────
# DJANGO REST FRAMEWORK
# ─────────────────────────────────────────────────────────────────────────────

REST_FRAMEWORK = {
    # Use JWT for all API endpoints by default
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.users.api_auth.APIKeyAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    # Require authentication by default; override per-view where needed
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    # Consistent JSON response structure is enforced in views/services
    "EXCEPTION_HANDLER": "apps.users.utils.custom_exception_handler",
}


# ─────────────────────────────────────────────────────────────────────────────
# SIMPLE JWT — Token lifetimes and signing
# ─────────────────────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": config("SECRET_KEY"),
}


# ─────────────────────────────────────────────────────────────────────────────
# DJANGO CHANNELS — WebSocket layer (in-memory for development)
# ─────────────────────────────────────────────────────────────────────────────

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# CELERY — Background task queue and periodic tasks
# ─────────────────────────────────────────────────────────────────────────────

# Celery Configuration
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Africa/Dar_es_Salaam'

# Fallback for Windows development 
# (if Redis not available):
# CELERY_BROKER_URL = 'memory://'
# CELERY_RESULT_BACKEND = 'cache+memory://'

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
  'cleanup-stale-vms': {
    'task': 'apps.vms.tasks.cleanup_stale_vms',
    'schedule': crontab(minute='*/30'),
  },
  'cleanup-expired-sessions': {
    'task': 'apps.vms.tasks.cleanup_expired_sessions',
    'schedule': crontab(minute=0),
  },
  'end-expired-live-sessions': {
    'task': 'apps.sessions.tasks.end_expired_sessions',
    'schedule': crontab(minute='*'),
  },
}

GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', default='')

import os
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

