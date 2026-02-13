#!/usr/bin/env bash
# ===========================================
# Title-Clash EC2 Server Initial Setup
# ===========================================
# Usage: ssh into EC2 Ubuntu instance, then:
#   curl -sSL <this-script-url> | bash
#   OR copy and run: bash setup-server.sh
# ===========================================
set -euo pipefail

echo "=========================================="
echo " Title-Clash Server Setup"
echo "=========================================="

# --- 1. System Update ---
echo "[1/7] Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# --- 2. Install Docker ---
echo "[2/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "  Docker installed. You may need to re-login for group changes."
else
  echo "  Docker already installed."
fi

# --- 3. Install Docker Compose plugin ---
echo "[3/7] Verifying Docker Compose..."
if docker compose version &>/dev/null; then
  echo "  Docker Compose plugin available."
else
  echo "  Installing Docker Compose plugin..."
  sudo apt-get install -y docker-compose-plugin
fi

# --- 4. Install Nginx ---
echo "[4/7] Installing Nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# --- 5. Install Certbot ---
echo "[5/7] Installing Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# --- 6. Create project directory ---
echo "[6/7] Setting up project directory..."
PROJECT_DIR=/home/$USER/title-clash
mkdir -p "$PROJECT_DIR"

# --- 7. Firewall (ufw) ---
echo "[7/7] Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Clone the repo:"
echo "     cd $PROJECT_DIR && git clone git@github.com:appback/title-clash.git ."
echo ""
echo "  2. Create .env file:"
echo "     cp docker/.env.production docker/.env"
echo "     nano docker/.env   # Fill in real secrets"
echo ""
echo "  3. Start services:"
echo "     cd docker && docker compose -f docker-compose.prod.yml --env-file .env up -d --build"
echo ""
echo "  4. Setup Nginx:"
echo "     sudo cp docker/nginx-host.conf /etc/nginx/sites-available/titleclash.com"
echo "     sudo ln -s /etc/nginx/sites-available/titleclash.com /etc/nginx/sites-enabled/"
echo "     sudo rm -f /etc/nginx/sites-enabled/default"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  5. Get SSL certificate (after DNS is pointing to this server):"
echo "     sudo certbot --nginx -d titleclash.com -d www.titleclash.com"
echo ""
echo "  6. Verify auto-renewal:"
echo "     sudo certbot renew --dry-run"
echo ""
