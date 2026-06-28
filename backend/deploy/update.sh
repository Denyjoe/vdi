#!/bin/bash
set -e
APP_DIR="/home/ditadmin/dit-vdi-system"

echo "Updating DIT VDI System..."
cd $APP_DIR
git pull origin main

cd backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

cd ../frontend
npm install
npm run build

sudo systemctl restart dit-vdi-gunicorn
sudo systemctl restart dit-vdi-daphne
sudo systemctl restart dit-vdi-celery
sudo systemctl restart nginx

echo "Update complete!"
