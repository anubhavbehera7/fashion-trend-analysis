# Deployment Guide

## Prerequisites

### Required
- Docker Engine 20.10+ and Docker Compose 2.0+
- 8GB RAM, 20GB disk space

### For Kubernetes
- kubectl 1.25+
- minikube (local) or cloud provider cluster (GKE/EKS/AKS)

---

## Docker Compose (Local Development)

### Start All Services
```bash
# Clone repository
git clone <repo-url>
cd fashion-trend-analysis

# Build and start (first run ~5-10 min for image pulls and builds)
docker-compose up -d

# Watch logs
docker-compose logs -f

# Verify all services are healthy
docker-compose ps
```

### Initialize Database
PostgreSQL schema is auto-applied via `docker-entrypoint-initdb.d/` on first run.
To manually re-apply:
```bash
make db-init
```

### Service URLs
| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3001 | — |
| API Gateway | http://localhost:3000 | — |
| ML Analysis API | http://localhost:8000/docs | — |
| Qdrant | http://localhost:6333/dashboard | — |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin123 |
| RabbitMQ | http://localhost:15672 | rabbit_user / rabbit_pass |
| PostgreSQL | localhost:5432 | fashion_user / fashion_password |

### Stop and Clean
```bash
docker-compose down          # Stop services (keep volumes)
docker-compose down -v       # Stop + delete all data
make clean                   # Nuclear option: delete everything including images
```

---

## Kubernetes — Local (minikube)

### Start minikube
```bash
minikube start --memory=8192 --cpus=4 --driver=docker

# Configure Docker to use minikube's daemon (so images are available to k8s)
eval $(minikube docker-env)
```

### Build Images
```bash
# Build all images (they'll be in minikube's Docker daemon)
docker-compose build --parallel
```

### Deploy
```bash
# Deploy dev overlay (reduced replicas)
kubectl apply -k k8s/overlays/dev/

# Watch deployment progress
kubectl get pods -n fashion-trends -w

# Check all resources
kubectl get all -n fashion-trends
```

### Access Services
```bash
# Port forward to local machine
kubectl port-forward -n fashion-trends svc/api-gateway 3000:3000 &
kubectl port-forward -n fashion-trends svc/ml-analysis 8000:8000 &
kubectl port-forward -n fashion-trends svc/qdrant 6333:6333 &

# OR use minikube tunnel (creates LoadBalancer IPs)
minikube tunnel
```

### Monitor HPA
```bash
# Watch auto-scaling in action
kubectl get hpa -n fashion-trends -w

# Generate load to trigger scaling
for i in {1..100}; do curl http://localhost:3000/api/trends; done
```

### Delete Deployment
```bash
kubectl delete -k k8s/overlays/dev/ --ignore-not-found=true
```

---

## Kubernetes — Cloud (GKE)

### GKE Setup
```bash
# Create cluster
gcloud container clusters create fashion-trends \
  --num-nodes=3 \
  --machine-type=e2-standard-4 \
  --region=us-central1

# Get credentials
gcloud container clusters get-credentials fashion-trends --region=us-central1

# Push images to Container Registry
docker tag fashion-api-gateway gcr.io/PROJECT_ID/api-gateway:latest
docker push gcr.io/PROJECT_ID/api-gateway:latest
# (repeat for other services)

# Update image references in k8s/base/*.yaml to use GCR images, then:
kubectl apply -k k8s/overlays/prod/
```

### EKS Setup
```bash
# Create cluster
eksctl create cluster --name fashion-trends --region us-east-1 --nodegroup-name workers \
  --node-type t3.large --nodes 3 --managed

# Push to ECR
aws ecr create-repository --repository-name fashion-api-gateway
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/fashion-api-gateway:latest
```

---

## Database Initialization

### Manual Schema Application
```bash
# Connect and apply schema
docker-compose exec postgres psql -U fashion_user -d fashion_trends -f /docker-entrypoint-initdb.d/01-schema.sql

# Or from host:
psql postgresql://fashion_user:fashion_password@localhost:5432/fashion_trends < docs/schema.sql
```

### Verify Data
```bash
docker-compose exec postgres psql -U fashion_user -d fashion_trends -c "SELECT * FROM trends;"
```

---

## Monitoring

### Deployment Status
```bash
kubectl get pods -n fashion-trends
kubectl describe pod <pod-name> -n fashion-trends
kubectl logs <pod-name> -n fashion-trends -f
```

### Resource Usage
```bash
kubectl top pods -n fashion-trends
kubectl top nodes
```

### HPA Status
```bash
kubectl get hpa -n fashion-trends
kubectl describe hpa api-gateway-hpa -n fashion-trends
```

---

## Troubleshooting

### Pod CrashLoopBackOff
```bash
kubectl logs <pod> -n fashion-trends --previous  # Previous container logs
kubectl describe pod <pod> -n fashion-trends      # Events and status
```

### Database Connection Refused
```bash
# Check PostgreSQL is ready
kubectl exec -n fashion-trends deploy/api-gateway -- \
  wget -qO- http://localhost:3000/health/ready

# Check PostgreSQL pod
kubectl logs -n fashion-trends statefulset/postgres
```

### Qdrant Collection Missing
Qdrant creates the collection automatically on first vector upsert.
If it's missing, check image-processor logs:
```bash
kubectl logs -n fashion-trends deploy/image-processor
```

### Out of Memory
Increase limits in `k8s/base/image-processor.yaml`:
```yaml
limits:
  memory: "4Gi"  # Increase from 2Gi
```

---

## Scaling Instructions

### Manual Scaling
```bash
# Scale image processor to 10 replicas
kubectl scale deploy/image-processor -n fashion-trends --replicas=10

# Or edit HPA range
kubectl edit hpa image-processor-hpa -n fashion-trends
```

### Load Testing (generate HPA trigger)
```bash
# Install k6 load testing tool
brew install k6

# Run load test (watch HPA scale up in another terminal)
k6 run --vus 50 --duration 60s - <<EOF
import http from 'k6/http';
export default function() {
  http.get('http://localhost:3000/api/trends');
}
EOF
```
