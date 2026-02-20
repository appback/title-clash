#!/usr/bin/env bash
# ===========================================
# Title-Clash EC2 Server Initial Setup
# ===========================================
# For Amazon Linux 2 (ec2-user)
# Usage: bash setup-server.sh
# ===========================================
set -euo pipefail

echo "=========================================="
echo " Title-Clash Server Setup (Amazon Linux 2)"
echo "=========================================="

# --- 1. System Update ---
echo "[1/7] Updating system packages..."
sudo yum update -y

# --- 2. Install Docker ---
echo "[2/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  sudo yum install -y docker
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker "$USER"
  echo "  Docker installed. Re-login required for group changes."
else
  echo "  Docker already installed."
  sudo systemctl start docker
fi

# --- 3. Install Docker Compose plugin ---
echo "[3/7] Installing Docker Compose..."
if docker compose version &>/dev/null 2>&1; then
  echo "  Docker Compose plugin available."
else
  DOCKER_COMPOSE_VERSION=v2.24.5
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -SL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  echo "  Docker Compose installed: $(docker compose version)"
fi

# --- 4. Install Nginx ---
echo "[4/7] Installing Nginx..."
sudo yum install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# --- 5. Install Certbot ---
echo "[5/7] Installing Certbot..."
sudo yum install -y augeas-libs
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot

# --- 6. Install Git ---
echo "[6/7] Installing Git..."
sudo yum install -y git

# --- 7. Create project directory ---
echo "[7/7] Setting up project directory..."
PROJECT_DIR=/home/$USER/title-clash
mkdir -p "$PROJECT_DIR"

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo " IMPORTANT: Re-login to apply docker group:"
echo "   exit"
echo "   ssh -i appback.pem ec2-user@43.201.163.136"
echo ""
echo " Then follow these steps:"
echo ""
echo "  1. Clone the repo:"
echo "     cd ~ && git clone https://github.com/appback/title-clash.git"
echo ""
echo "  2. Create .env file:"
echo "     cd ~/title-clash/docker"
echo "     cp .env.production .env"
echo "     vi .env   # Fill in real secrets"
echo ""
echo "  3. Start services:"
echo "     docker compose -f docker-compose.prod.yml --env-file .env up -d --build"
echo ""
echo "  4. Setup Nginx:"
echo "     sudo cp ~/title-clash/docker/nginx-host.conf /etc/nginx/conf.d/titleclash.conf"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  5. Get SSL certificate (after DNS is pointing to this server):"
echo "     sudo certbot --nginx -d titleclash.com -d www.titleclash.com"
echo ""
echo "  6. Setup auto-renewal cron:"
echo "     echo '0 0,12 * * * root /usr/bin/certbot renew -q' | sudo tee /etc/cron.d/certbot"
echo ""
