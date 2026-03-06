#!/bin/bash
# KrishiAI Production Deployment Script

set -e

echo "🚀 Starting KrishiAI Production Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME="krishiai-production"
AWS_REGION="ap-south-1"
NAMESPACE="krishiai-prod"

# Step 1: Verify prerequisites
echo -e "${YELLOW}Step 1: Verifying prerequisites...${NC}"
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}kubectl is required but not installed.${NC}" >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo -e "${RED}AWS CLI is required but not installed.${NC}" >&2; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo -e "${RED}Terraform is required but not installed.${NC}" >&2; exit 1; }

# Step 2: Apply Terraform infrastructure
echo -e "${YELLOW}Step 2: Provisioning infrastructure with Terraform...${NC}"
cd terraform
terraform init
terraform plan -out=tfplan
read -p "Review the plan above. Continue with apply? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
    terraform apply tfplan
    echo -e "${GREEN}✓ Infrastructure provisioned${NC}"
else
    echo -e "${RED}Deployment cancelled${NC}"
    exit 1
fi
cd ..

# Step 3: Configure kubectl
echo -e "${YELLOW}Step 3: Configuring kubectl...${NC}"
aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION
echo -e "${GREEN}✓ kubectl configured${NC}"

# Step 4: Create namespace
echo -e "${YELLOW}Step 4: Creating Kubernetes namespace...${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
kubectl label namespace $NAMESPACE environment=production
echo -e "${GREEN}✓ Namespace created${NC}"

# Step 5: Create secrets
echo -e "${YELLOW}Step 5: Creating Kubernetes secrets...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}Error: .env.production file not found${NC}"
    exit 1
fi

# Load environment variables
source .env.production

kubectl create secret generic krishiai-secrets \
  --from-literal=db-host=$DB_HOST \
  --from-literal=db-password=$DB_PASSWORD \
  --from-literal=redis-host=$REDIS_HOST \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=sms-api-key=$SMS_API_KEY \
  --from-literal=imd-api-key=$IMD_API_KEY \
  --namespace=$NAMESPACE \
  --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓ Secrets created${NC}"

# Step 6: Deploy services
echo -e "${YELLOW}Step 6: Deploying microservices...${NC}"
kubectl apply -f ../k8s/configmap.yaml -n $NAMESPACE
kubectl apply -f ../k8s/postgres-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/redis-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/auth-service-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/crop-service-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/market-service-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/climate-service-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/govt-service-deployment.yaml -n $NAMESPACE
kubectl apply -f ../k8s/nginx-ingress.yaml -n $NAMESPACE

echo -e "${GREEN}✓ Services deployed${NC}"

# Step 7: Wait for deployments
echo -e "${YELLOW}Step 7: Waiting for deployments to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s \
  deployment/auth-service \
  deployment/crop-service \
  deployment/market-service \
  deployment/climate-service \
  deployment/govt-service \
  -n $NAMESPACE

echo -e "${GREEN}✓ All deployments ready${NC}"

# Step 8: Run database migrations
echo -e "${YELLOW}Step 8: Running database migrations...${NC}"
kubectl run migration-job --image=krishiai/migration-runner:latest \
  --restart=Never \
  --namespace=$NAMESPACE \
  --env="DB_HOST=$DB_HOST" \
  --env="DB_PASSWORD=$DB_PASSWORD"

kubectl wait --for=condition=complete --timeout=300s job/migration-job -n $NAMESPACE
echo -e "${GREEN}✓ Migrations completed${NC}"

# Step 9: Verify deployment
echo -e "${YELLOW}Step 9: Verifying deployment...${NC}"
bash ../k8s/verify-deployment.sh

# Step 10: Display access information
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Production deployment completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Cluster: $CLUSTER_NAME"
echo "Namespace: $NAMESPACE"
echo "Region: $AWS_REGION"
echo ""
echo "To view services:"
echo "  kubectl get services -n $NAMESPACE"
echo ""
echo "To view pods:"
echo "  kubectl get pods -n $NAMESPACE"
echo ""
echo "To view logs:"
echo "  kubectl logs -f deployment/<service-name> -n $NAMESPACE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Configure DNS to point to the load balancer"
echo "2. Set up monitoring dashboards"
echo "3. Configure alerting rules"
echo "4. Run smoke tests"
