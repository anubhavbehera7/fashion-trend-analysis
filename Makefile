
# Fashion Trend Analysis Platform - Makefile
.PHONY: help build up down logs ps clean dev-api dev-ml \
        test test-api test-ml test-scraper \
        k8s-build k8s-deploy-dev k8s-deploy-prod k8s-delete \
        k8s-status k8s-logs-api k8s-logs-ml k8s-logs-processor k8s-port-forward \
        db-connect db-init monitor format install lint health-check

.DEFAULT_GOAL := help

CYAN   := \033[0;36m
GREEN  := \033[0;32m
YELLOW := \033[1;33m
RED    := \033[0;31m
NC     := \033[0m

K8S_NAMESPACE := fashion-trends

help: ## Show this help message
	@echo '$(CYAN)Fashion Trend Analysis Platform$(NC)'
	@echo ''
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(CYAN)%-25s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─── Docker Compose ───────────────────────────────────────────────────────────

build: ## Build all Docker images
	@echo "$(CYAN)Building all services...$(NC)"
	docker-compose build --parallel

up: ## Start all services
	@echo "$(GREEN)Starting all services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Access points:$(NC)"
	@echo "  Frontend:   http://localhost:3001"
	@echo "  API:        http://localhost:3000"
	@echo "  ML API:     http://localhost:8000/docs"
	@echo "  Qdrant:     http://localhost:6333/dashboard"
	@echo "  MinIO:      http://localhost:9001"

down: ## Stop all services
	docker-compose down

logs: ## Stream logs from all services
	docker-compose logs -f

ps: ## Show service status
	docker-compose ps

clean: ## Remove containers, volumes, and images
	@echo "$(RED)Cleaning up...$(NC)"
	docker-compose down -v --remove-orphans
	docker system prune -f

restart: ## Restart all services
	docker-compose restart

# ─── Development ──────────────────────────────────────────────────────────────

dev-api: ## Run API Gateway locally
	cd services/api-gateway && npm install && npm run dev

dev-ml: ## Run ML Analysis service locally
	cd services/ml-analysis && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

install: ## Install all dependencies
	cd services/api-gateway && npm install
	cd services/ml-analysis && pip install -r requirements.txt
	cd services/web-scraper && pip install -r requirements.txt

format: ## Format all code
	cd services/api-gateway && npx prettier --write src/
	cd services/ml-analysis && black .
	cd services/web-scraper && black .

lint: ## Lint all services
	cd services/api-gateway && npm run lint
	cd services/ml-analysis && flake8 .

# ─── Testing ──────────────────────────────────────────────────────────────────

test: test-api test-ml ## Run all tests

test-api: ## Test API Gateway
	cd services/api-gateway && npm test

test-ml: ## Test ML Analysis service
	cd services/ml-analysis && pytest tests/ -v

test-scraper: ## Test Web Scraper
	cd services/web-scraper && pytest tests/ -v

# ─── Database ─────────────────────────────────────────────────────────────────

db-connect: ## Connect to PostgreSQL
	docker-compose exec postgres psql -U fashion_user -d fashion_trends

db-init: ## Initialize database schema
	docker-compose exec -T postgres psql -U fashion_user -d fashion_trends < docs/schema.sql

# ─── Kubernetes ───────────────────────────────────────────────────────────────

k8s-deploy-dev: ## Deploy to Kubernetes dev environment
	kubectl apply -k k8s/overlays/dev/

k8s-deploy-prod: ## Deploy to Kubernetes prod environment
	kubectl apply -k k8s/overlays/prod/

k8s-delete: ## Delete Kubernetes deployment
	kubectl delete -k k8s/overlays/dev/ --ignore-not-found=true

k8s-status: ## Check Kubernetes status
	kubectl get all -n $(K8S_NAMESPACE)
	kubectl get hpa -n $(K8S_NAMESPACE)

k8s-logs-api: ## Stream API Gateway k8s logs
	kubectl logs -f -l app=api-gateway -n $(K8S_NAMESPACE)

k8s-logs-ml: ## Stream ML Analysis k8s logs
	kubectl logs -f -l app=ml-analysis -n $(K8S_NAMESPACE)

k8s-logs-processor: ## Stream Image Processor k8s logs
	kubectl logs -f -l app=image-processor -n $(K8S_NAMESPACE)

k8s-port-forward: ## Port forward all services
	kubectl port-forward -n $(K8S_NAMESPACE) svc/api-gateway 3000:3000 &
	kubectl port-forward -n $(K8S_NAMESPACE) svc/ml-analysis 8000:8000 &
	kubectl port-forward -n $(K8S_NAMESPACE) svc/qdrant 6333:6333 &
	wait

# ─── Monitoring ───────────────────────────────────────────────────────────────

monitor: ## Open monitoring dashboards
	open http://localhost:6333/dashboard
	open http://localhost:9001
	open http://localhost:15672
	open http://localhost:8000/docs

health-check: ## Check health of all services
	@curl -sf http://localhost:3000/health > /dev/null && echo "$(GREEN)API Gateway:      OK$(NC)" || echo "$(RED)API Gateway:      FAIL$(NC)"
	@curl -sf http://localhost:8080/health > /dev/null && echo "$(GREEN)Image Processor:  OK$(NC)" || echo "$(RED)Image Processor:  FAIL$(NC)"
	@curl -sf http://localhost:8000/health > /dev/null && echo "$(GREEN)ML Analysis:      OK$(NC)" || echo "$(RED)ML Analysis:      FAIL$(NC)"
	@curl -sf http://localhost:6333/health > /dev/null && echo "$(GREEN)Qdrant:           OK$(NC)" || echo "$(RED)Qdrant:           FAIL$(NC)"