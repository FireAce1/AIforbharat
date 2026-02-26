# KrishiAI Infrastructure

Infrastructure as Code and deployment configurations.

## Contents

- **k8s**: Kubernetes manifests
- **terraform**: Cloud infrastructure provisioning
- **docker**: Dockerfiles and build scripts

## Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Provision infrastructure
cd terraform && terraform apply
```
