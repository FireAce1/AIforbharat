# Security Groups for KrishiAI Production

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "krishiai-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "PostgreSQL from EKS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "krishiai-rds-sg"
  }
}

# Redis Security Group
resource "aws_security_group" "redis" {
  name        = "krishiai-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id
  
  ingress {
    description     = "Redis from EKS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "krishiai-redis-sg"
  }
}

# Subnet Groups
resource "aws_db_subnet_group" "main" {
  name       = "krishiai-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  
  tags = {
    Name = "krishiai-db-subnet-group"
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "krishiai-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}
