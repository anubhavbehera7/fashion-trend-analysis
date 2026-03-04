#!/usr/bin/env bash
# quick-start.sh — Fashion Trend Analysis Platform Quick Start
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

print_banner() {
  echo -e "${CYAN}"
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║         Fashion Trend Analysis Platform                   ║"
  echo "║              Quick Start Script v1.0                      ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
}

check_prerequisites() {
  log_info "Checking prerequisites..."
  local errors=0

  if command -v docker &>/dev/null; then
    log_success "Docker: $(docker --version)"
  else
    log_error "Docker not installed. See https://docs.docker.com/get-docker/"
    ((errors++))
  fi

  if docker compose version &>/dev/null 2>&1 || command -v docker-compose &>/dev/null; then
    log_success "Docker Compose: found"
  else
    log_error "Docker Compose not found."
    ((errors++))
  fi

  command -v kubectl &>/dev/null && log_success "kubectl: found" || log_warn "kubectl not found (needed for Kubernetes only)"

  if [[ "$(uname)" == "Darwin" ]]; then
    local mem_gb=$(( $(sysctl -n hw.memsize) / 1073741824 ))
    [[ $mem_gb -lt 8 ]] && log_warn "Less than 8GB RAM (${mem_gb}GB). Services may be slow." || log_success "Memory: ${mem_gb}GB"
  fi

  [[ $errors -gt 0 ]] && { log_error "Fix errors above and re-run."; exit 1; }
  log_success "All prerequisites met!"
}

select_deployment() {
  echo ""
  echo -e "${BOLD}Choose deployment type:${NC}"
  echo "  1) Docker Compose (Recommended)"
  echo "  2) Kubernetes (requires minikube)"
  echo "  3) Exit"
  echo ""
  read -rp "Enter choice [1-3]: " choice
  case $choice in
    1) deploy_docker_compose ;;
    2) deploy_kubernetes ;;
    3) echo "Exiting."; exit 0 ;;
    *) log_error "Invalid choice."; select_deployment ;;
  esac
}

deploy_docker_compose() {
  log_info "Building Docker images (first run takes 5-10 minutes)..."
  docker-compose build --parallel
  log_success "Images built"

  log_info "Starting all services..."
  docker-compose up -d

  log_info "Waiting for API Gateway to be healthy..."
  local attempt=0
  while [[ $attempt -lt 30 ]]; do
    curl -sf http://localhost:3000/health >/dev/null 2>&1 && break
    ((attempt++)); sleep 5; echo -n "."
  done
  echo ""

  echo ""
  echo -e "${GREEN}${BOLD}All services started!${NC}"
  echo ""
  echo "  Frontend:    http://localhost:3001"
  echo "  API:         http://localhost:3000"
  echo "  ML API docs: http://localhost:8000/docs"
  echo "  Qdrant UI:   http://localhost:6333/dashboard"
  echo "  MinIO:       http://localhost:9001 (minioadmin/minioadmin123)"
  echo "  RabbitMQ:    http://localhost:15672 (rabbit_user/rabbit_pass)"
  echo ""
  echo "  curl http://localhost:3000/health"
  echo "  curl http://localhost:3000/api/trends"
}

deploy_kubernetes() {
  if command -v minikube &>/dev/null; then
    log_info "Starting minikube..."
    minikube start --memory=8192 --cpus=4 --driver=docker
    eval "$(minikube docker-env)"
  else
    log_warn "minikube not found. Using existing cluster context."
  fi

  log_info "Building images..."
  docker-compose build --parallel

  log_info "Applying Kubernetes manifests..."
  kubectl apply -k k8s/overlays/dev/
  kubectl rollout status deployment/api-gateway -n fashion-trends --timeout=300s

  echo ""
  echo -e "${GREEN}Kubernetes deployment ready!${NC}"
  echo "  kubectl port-forward -n fashion-trends svc/api-gateway 3000:3000 &"
  echo "  kubectl get all -n fashion-trends"
}

main() {
  print_banner
  check_prerequisites
  select_deployment
}

main "$@"
