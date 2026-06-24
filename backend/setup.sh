#!/bin/bash
# Malwa Solar CRM — Backend Setup Script
# Run this on Ubuntu 22.04 VPS after git clone

set -e

echo "=== 1. System packages ==="
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip postgresql postgresql-contrib redis-server nginx curl

echo "=== 2. PostgreSQL setup ==="
sudo systemctl start postgresql
sudo systemctl enable postgresql
sudo -u postgres psql -c "CREATE USER malwa_user WITH PASSWORD 'StrongPassword123';"
sudo -u postgres psql -c "CREATE DATABASE malwa_solar_db OWNER malwa_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE malwa_solar_db TO malwa_user;"

echo "=== 3. Python virtual environment ==="
cd /var/www/malwa_solar/backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "=== 4. Environment file ==="
cp .env.example .env
echo "Edit /var/www/malwa_solar/backend/.env with your values!"

echo "=== 5. Django setup ==="
python manage.py migrate --settings=malwa_solar.settings.production
python manage.py collectstatic --noinput --settings=malwa_solar.settings.production
python manage.py createsuperuser --settings=malwa_solar.settings.production

echo "=== Done! Next: configure Nginx + Gunicorn systemd services ==="
