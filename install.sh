#!/usr/bin/env bash
set -euo pipefail

# OllaFlow One-Line Deployment Script
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/install.sh | bash
# Or:   bash install.sh

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "   OllaFlow - Ollama Cloud Proxy Gateway"
echo "========================================="
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "Error: Docker is not installed."
  echo "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "Error: Docker daemon is not running."
  echo "Start Docker and try again."
  exit 1
fi

# Check docker compose
if docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "Error: Docker Compose is not installed."
  exit 1
fi

# Generate encryption key and JWT secret
generate_key() {
  openssl rand -hex 24
}

# Create .env if not exists
if [ ! -f .env ]; then
  echo "Generating default configuration..."
  ENCRYPTION_KEY=$(generate_key)
  JWT_SECRET=$(generate_key)

  cat > .env << EOF
PORT=3000
NODE_ENV=production
DATABASE_URL=file:/app/prisma/data/app.db
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_SECRET=${JWT_SECRET}
OLLAMA_CLOUD_HOST=https://ollama.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin
LOG_RETENTION_DAYS=30
SAVE_REQUEST_BODIES=false
SAVE_RESPONSE_BODIES=false
EOF
  echo ""
  echo "Created .env with generated secrets."
  echo "IMPORTANT: Change ADMIN_PASSWORD before deploying to production!"
  echo ""
fi

# Build and start
echo "Building OllaFlow..."
$COMPOSE build

echo ""
echo "Starting OllaFlow..."
$COMPOSE up -d

echo ""
echo "Waiting for service to start..."
sleep 3

# Health check
HEALTH=$(curl -s http://localhost:3000/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q "ok"; then
  echo ""
  echo "========================================="
  echo "  OllaFlow is running!"
  echo "========================================="
  echo ""
  echo "  Proxy API:    http://localhost:3000/api"
  echo "  OpenAI Compat: http://localhost:3000/v1"
  echo "  Admin Panel:   http://localhost:3000/admin"
  echo ""
  echo "  Default login: admin / admin"
  echo "  (Change ADMIN_PASSWORD in .env)"
  echo ""
  echo "  Useful commands:"
  echo "    $COMPOSE logs -f      # View logs"
  echo "    $COMPOSE down         # Stop service"
  echo "    $COMPOSE restart      # Restart service"
  echo ""
else
  echo ""
  echo "OllaFlow may still be starting. Check logs:"
  echo "  $COMPOSE logs -f"
  echo ""
fi