#!/bin/bash

# KrishiAI CDN Setup Script
# Purpose: Configure CloudFront CDN for static assets and API caching
# Requirements: AWS CLI configured with appropriate credentials

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="ap-south-1"
S3_BUCKET_STATIC="krishiai-static-assets"
S3_BUCKET_MODELS="krishiai-ml-models"
S3_BUCKET_LOGS="krishiai-cdn-logs"
DOMAIN_NAME="cdn.krishiai.com"
CERTIFICATE_DOMAIN="*.krishiai.com"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}KrishiAI CDN Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Step 1: Create S3 buckets
echo -e "\n${YELLOW}Step 1: Creating S3 buckets...${NC}"

create_bucket() {
    local bucket_name=$1
    
    if aws s3 ls "s3://${bucket_name}" 2>&1 | grep -q 'NoSuchBucket'; then
        echo "Creating bucket: ${bucket_name}"
        aws s3 mb "s3://${bucket_name}" --region ${AWS_REGION}
        
        # Enable versioning
        aws s3api put-bucket-versioning \
            --bucket ${bucket_name} \
            --versioning-configuration Status=Enabled
        
        # Enable encryption
        aws s3api put-bucket-encryption \
            --bucket ${bucket_name} \
            --server-side-encryption-configuration '{
                "Rules": [{
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    }
                }]
            }'
        
        echo -e "${GREEN}✓ Bucket created: ${bucket_name}${NC}"
    else
        echo -e "${GREEN}✓ Bucket already exists: ${bucket_name}${NC}"
    fi
}

create_bucket ${S3_BUCKET_STATIC}
create_bucket ${S3_BUCKET_MODELS}
create_bucket ${S3_BUCKET_LOGS}

# Step 2: Configure bucket policies
echo -e "\n${YELLOW}Step 2: Configuring bucket policies...${NC}"

# Static assets bucket policy
cat > /tmp/static-bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ABCDEFG1234567"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${S3_BUCKET_STATIC}/*"
        }
    ]
}
EOF

aws s3api put-bucket-policy \
    --bucket ${S3_BUCKET_STATIC} \
    --policy file:///tmp/static-bucket-policy.json

echo -e "${GREEN}✓ Bucket policies configured${NC}"

# Step 3: Upload static assets
echo -e "\n${YELLOW}Step 3: Uploading static assets...${NC}"

# Create sample static assets structure
mkdir -p /tmp/krishiai-static/{images,css,js,fonts,videos}

# Upload to S3 with appropriate cache headers
aws s3 sync /tmp/krishiai-static/ s3://${S3_BUCKET_STATIC}/static/ \
    --cache-control "public, max-age=31536000, immutable" \
    --metadata-directive REPLACE

echo -e "${GREEN}✓ Static assets uploaded${NC}"

# Step 4: Request ACM certificate (if not exists)
echo -e "\n${YELLOW}Step 4: Checking SSL certificate...${NC}"

CERT_ARN=$(aws acm list-certificates \
    --region us-east-1 \
    --query "CertificateSummaryList[?DomainName=='${CERTIFICATE_DOMAIN}'].CertificateArn" \
    --output text)

if [ -z "$CERT_ARN" ]; then
    echo "Requesting new certificate for ${CERTIFICATE_DOMAIN}"
    CERT_ARN=$(aws acm request-certificate \
        --domain-name ${CERTIFICATE_DOMAIN} \
        --subject-alternative-names ${DOMAIN_NAME} \
        --validation-method DNS \
        --region us-east-1 \
        --query CertificateArn \
        --output text)
    
    echo -e "${YELLOW}⚠ Certificate requested. Please validate via DNS before proceeding.${NC}"
    echo "Certificate ARN: ${CERT_ARN}"
else
    echo -e "${GREEN}✓ Certificate already exists: ${CERT_ARN}${NC}"
fi

# Step 5: Create CloudFront Origin Access Identity
echo -e "\n${YELLOW}Step 5: Creating CloudFront Origin Access Identity...${NC}"

OAI_ID=$(aws cloudfront list-cloud-front-origin-access-identities \
    --query "CloudFrontOriginAccessIdentityList.Items[?Comment=='KrishiAI OAI'].Id" \
    --output text)

if [ -z "$OAI_ID" ]; then
    OAI_ID=$(aws cloudfront create-cloud-front-origin-access-identity \
        --cloud-front-origin-access-identity-config \
        CallerReference="krishiai-oai-$(date +%s)",Comment="KrishiAI OAI" \
        --query CloudFrontOriginAccessIdentity.Id \
        --output text)
    
    echo -e "${GREEN}✓ OAI created: ${OAI_ID}${NC}"
else
    echo -e "${GREEN}✓ OAI already exists: ${OAI_ID}${NC}"
fi

# Step 6: Create CloudFront distribution
echo -e "\n${YELLOW}Step 6: Creating CloudFront distribution...${NC}"

# Update config file with actual values
sed -i "s/ABCDEFG1234567/${OAI_ID}/g" cloudfront-config.json
sed -i "s/ACCOUNT_ID/$(aws sts get-caller-identity --query Account --output text)/g" cloudfront-config.json
sed -i "s/CERTIFICATE_ID/${CERT_ARN##*/}/g" cloudfront-config.json

# Create distribution
DIST_ID=$(aws cloudfront create-distribution \
    --distribution-config file://cloudfront-config.json \
    --query Distribution.Id \
    --output text 2>/dev/null || echo "")

if [ -n "$DIST_ID" ]; then
    echo -e "${GREEN}✓ CloudFront distribution created: ${DIST_ID}${NC}"
    
    # Get distribution domain name
    DIST_DOMAIN=$(aws cloudfront get-distribution \
        --id ${DIST_ID} \
        --query Distribution.DomainName \
        --output text)
    
    echo -e "${GREEN}Distribution Domain: ${DIST_DOMAIN}${NC}"
else
    echo -e "${YELLOW}⚠ Distribution may already exist or creation failed${NC}"
fi

# Step 7: Create cache policies
echo -e "\n${YELLOW}Step 7: Creating custom cache policies...${NC}"

# API cache policy (1 hour TTL)
cat > /tmp/api-cache-policy.json <<EOF
{
    "Name": "KrishiAI-API-Cache-Policy",
    "Comment": "Cache policy for KrishiAI API responses",
    "DefaultTTL": 3600,
    "MaxTTL": 86400,
    "MinTTL": 0,
    "ParametersInCacheKeyAndForwardedToOrigin": {
        "EnableAcceptEncodingGzip": true,
        "EnableAcceptEncodingBrotli": true,
        "QueryStringsConfig": {
            "QueryStringBehavior": "all"
        },
        "HeadersConfig": {
            "HeaderBehavior": "whitelist",
            "Headers": {
                "Quantity": 2,
                "Items": ["Authorization", "Accept-Language"]
            }
        },
        "CookiesConfig": {
            "CookieBehavior": "none"
        }
    }
}
EOF

aws cloudfront create-cache-policy \
    --cache-policy-config file:///tmp/api-cache-policy.json \
    2>/dev/null || echo "Cache policy may already exist"

echo -e "${GREEN}✓ Cache policies configured${NC}"

# Step 8: Configure WAF (Web Application Firewall)
echo -e "\n${YELLOW}Step 8: Configuring WAF...${NC}"

# Create WAF WebACL
cat > /tmp/waf-config.json <<EOF
{
    "Name": "krishiai-waf",
    "Scope": "CLOUDFRONT",
    "DefaultAction": {
        "Allow": {}
    },
    "Rules": [
        {
            "Name": "RateLimitRule",
            "Priority": 1,
            "Statement": {
                "RateBasedStatement": {
                    "Limit": 2000,
                    "AggregateKeyType": "IP"
                }
            },
            "Action": {
                "Block": {}
            },
            "VisibilityConfig": {
                "SampledRequestsEnabled": true,
                "CloudWatchMetricsEnabled": true,
                "MetricName": "RateLimitRule"
            }
        },
        {
            "Name": "GeoBlockRule",
            "Priority": 2,
            "Statement": {
                "NotStatement": {
                    "Statement": {
                        "GeoMatchStatement": {
                            "CountryCodes": ["IN"]
                        }
                    }
                }
            },
            "Action": {
                "Block": {}
            },
            "VisibilityConfig": {
                "SampledRequestsEnabled": true,
                "CloudWatchMetricsEnabled": true,
                "MetricName": "GeoBlockRule"
            }
        }
    ],
    "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "krishiai-waf"
    }
}
EOF

aws wafv2 create-web-acl \
    --region us-east-1 \
    --cli-input-json file:///tmp/waf-config.json \
    2>/dev/null || echo "WAF may already exist"

echo -e "${GREEN}✓ WAF configured${NC}"

# Step 9: Create DNS records
echo -e "\n${YELLOW}Step 9: DNS Configuration${NC}"
echo -e "${YELLOW}Please create the following DNS records:${NC}"
echo ""
echo "Type: CNAME"
echo "Name: ${DOMAIN_NAME}"
echo "Value: ${DIST_DOMAIN}"
echo "TTL: 300"
echo ""

# Step 10: Test CDN
echo -e "\n${YELLOW}Step 10: Testing CDN...${NC}"

if [ -n "$DIST_DOMAIN" ]; then
    echo "Testing CDN endpoint: https://${DIST_DOMAIN}"
    
    # Wait for distribution to deploy
    echo "Waiting for distribution to deploy (this may take 10-15 minutes)..."
    aws cloudfront wait distribution-deployed --id ${DIST_ID}
    
    # Test endpoint
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DIST_DOMAIN}/static/test.html" || echo "000")
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        echo -e "${GREEN}✓ CDN is responding${NC}"
    else
        echo -e "${YELLOW}⚠ CDN returned HTTP ${HTTP_CODE}${NC}"
    fi
fi

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}CDN Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "S3 Buckets:"
echo "  - Static Assets: s3://${S3_BUCKET_STATIC}"
echo "  - ML Models: s3://${S3_BUCKET_MODELS}"
echo "  - Logs: s3://${S3_BUCKET_LOGS}"
echo ""
echo "CloudFront:"
echo "  - Distribution ID: ${DIST_ID}"
echo "  - Domain: ${DIST_DOMAIN}"
echo ""
echo "Next Steps:"
echo "  1. Validate ACM certificate via DNS"
echo "  2. Create DNS CNAME record"
echo "  3. Upload production assets to S3"
echo "  4. Test CDN endpoints"
echo "  5. Monitor CloudWatch metrics"
echo ""

# Cleanup temp files
rm -f /tmp/static-bucket-policy.json
rm -f /tmp/api-cache-policy.json
rm -f /tmp/waf-config.json

echo -e "${GREEN}Done!${NC}"
