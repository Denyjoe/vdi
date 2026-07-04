#!/bin/bash
set -e  # Exit on any error

echo "========================================="
echo "DIT VDI System — Production Deployment"
echo "========================================="

SERVER_IP="192.168.1.13"
APP_DIR="/home/ditadmin/dit-vdi-system"
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"
# Replace with your actual GitHub repo URL

# ─── STEP 1: System Updates ───
echo "[1/12] Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  python3 python3-pip python3-venv \
  nodejs npm \
  nginx \
  postgresql postgresql-contrib \
  redis-server \
  git \
  curl \
  build-essential \
  python3-dev \
  libpq-dev

# ─── STEP 2: PostgreSQL Setup ───
echo "[2/12] Setting up PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -u postgres psql -c \
  "CREATE USER dit_vdi_user 
   WITH PASSWORD 'DIT_VDI_SecurePass2026!';" \
  2>/dev/null || echo "User exists"

sudo -u postgres psql -c \
  "CREATE DATABASE dit_vdi_db 
   OWNER dit_vdi_user;" \
  2>/dev/null || echo "DB exists"

sudo -u postgres psql -c \
  "GRANT ALL PRIVILEGES ON DATABASE 
   dit_vdi_db TO dit_vdi_user;"

# ─── STEP 3: Redis Setup ───
echo "[3/12] Starting Redis..."
sudo systemctl start redis-server
sudo systemctl enable redis-server

# ─── STEP 4: Clone Repository ───
echo "[4/12] Cloning repository..."
cd /home/ditadmin
if [ -d "dit-vdi-system" ]; then
  cd dit-vdi-system
  git pull origin main
else
  git clone $REPO_URL dit-vdi-system
  cd dit-vdi-system
fi

# ─── STEP 5: Backend Setup ───
echo "[5/12] Setting up Django backend..."
cd $APP_DIR/backend

python3 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn

# Create production .env
cat > .env << 'EOF'
SECRET_KEY=DIT-VDI-Production-Secret-Key-Change-This-2026-Secure
DEBUG=False
ALLOWED_HOSTS=192.168.1.13,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://192.168.1.13
DB_NAME=dit_vdi_db
DB_USER=dit_vdi_user
DB_PASSWORD=DIT_VDI_SecurePass2026!
DB_HOST=localhost
DB_PORT=5432
PROXMOX_HOST=https://your-proxmox-ip:8006
PROXMOX_USER=root@pam
PROXMOX_TOKEN_NAME=your-token-name
PROXMOX_TOKEN_SECRET=your-token-secret
PROXMOX_VERIFY_SSL=False
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
EOF

echo "Created .env file"

# Run migrations
python manage.py migrate
python manage.py seed_data
python manage.py collectstatic --noinput

deactivate

# ─── STEP 6: Frontend Build ───
echo "[6/12] Building React frontend..."
cd $APP_DIR/frontend

# Since we use environment variables now, we don't strictly need sed for API URLs.
# But keeping it just in case as requested by user.
sed -i 's|http://localhost:8000|http://192.168.1.13/api|g' src/services/api.js || true
sed -i 's|http://localhost:8000/api|http://192.168.1.13/api|g' src/services/api.js || true

npm install
npm run build

echo "Frontend built successfully"

# ─── STEP 7: Gunicorn Service ───
echo "[7/12] Creating Gunicorn service..."
sudo tee /etc/systemd/system/dit-vdi-gunicorn.service > /dev/null << EOF
[Unit]
Description=DIT VDI Gunicorn Daemon
After=network.target

[Service]
User=ditadmin
Group=www-data
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/gunicorn \
  --workers 3 \
  --bind unix:$APP_DIR/backend/dit_vdi.sock \
  config.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# ─── STEP 8: Daphne Service (WebSocket) ───
echo "[8/12] Creating Daphne service..."
sudo tee /etc/systemd/system/dit-vdi-daphne.service > /dev/null << EOF
[Unit]
Description=DIT VDI Daphne ASGI Server
After=network.target

[Service]
User=ditadmin
Group=www-data
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/daphne \
  -u $APP_DIR/backend/dit_vdi_asgi.sock \
  config.asgi:application
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# ─── STEP 9: Celery Service ───
echo "[9/12] Creating Celery service..."
sudo tee /etc/systemd/system/dit-vdi-celery.service > /dev/null << EOF
[Unit]
Description=DIT VDI Celery Worker
After=network.target redis.service

[Service]
User=ditadmin
Group=www-data
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/celery \
  -A config worker \
  --loglevel=info \
  --concurrency=2
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# ─── STEP 10: Nginx Configuration ───
echo "[10/12] Configuring Nginx..."
sudo tee /etc/nginx/sites-available/dit-vdi << EOF
server {
    listen 80;
    server_name 192.168.1.13;

    client_max_body_size 100M;

    # React Frontend
    location / {
        root $APP_DIR/frontend/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Django REST API
    location /api/ {
        proxy_pass http://unix:$APP_DIR/backend/dit_vdi.sock;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    # Django Admin
    location /admin/ {
        proxy_pass http://unix:$APP_DIR/backend/dit_vdi.sock;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Static files
    location /static/ {
        alias $APP_DIR/backend/staticfiles/;
    }

    # Media files
    location /media/ {
        alias $APP_DIR/backend/media/;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://unix:$APP_DIR/backend/dit_vdi_asgi.sock;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

sudo ln -sf \
  /etc/nginx/sites-available/dit-vdi \
  /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# ─── STEP 11: Start All Services ───
echo "[11/12] Starting all services..."
sudo systemctl daemon-reload

sudo systemctl enable dit-vdi-gunicorn
sudo systemctl start dit-vdi-gunicorn

sudo systemctl enable dit-vdi-daphne
sudo systemctl start dit-vdi-daphne

sudo systemctl enable dit-vdi-celery
sudo systemctl start dit-vdi-celery

# ─── STEP 12: Verify Deployment ───
echo "[12/12] Verifying deployment..."
sleep 3

echo ""
echo "Service Status:"
sudo systemctl is-active dit-vdi-gunicorn \
  && echo "✓ Gunicorn: Running" \
  || echo "✗ Gunicorn: FAILED"

sudo systemctl is-active dit-vdi-daphne \
  && echo "✓ Daphne: Running" \
  || echo "✗ Daphne: FAILED"

sudo systemctl is-active dit-vdi-celery \
  && echo "✓ Celery: Running" \
  || echo "✗ Celery: FAILED"

sudo systemctl is-active nginx \
  && echo "✓ Nginx: Running" \
  || echo "✗ Nginx: FAILED"

sudo systemctl is-active postgresql \
  && echo "✓ PostgreSQL: Running" \
  || echo "✗ PostgreSQL: FAILED"

sudo systemctl is-active redis-server \
  && echo "✓ Redis: Running" \
  || echo "✗ Redis: FAILED"

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "Access your system at:"
echo "http://192.168.1.13"
echo ""
echo "Admin login:"
echo "Email: admin@dit.ac.tz"
echo "Password: Test1234!"
echo "========================================="
