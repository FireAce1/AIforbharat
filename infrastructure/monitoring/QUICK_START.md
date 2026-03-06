# KrishiAI Monitoring - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Start the Monitoring Stack

```powershell
# Windows PowerShell
cd infrastructure/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

```bash
# Linux/Mac
cd infrastructure/monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### Step 2: Access Grafana

1. Open browser: http://localhost:3000
2. Login:
   - Username: `admin`
   - Password: `krishiai_admin_2024`
3. Navigate to: **Dashboards** → **KrishiAI** folder

### Step 3: View Your Dashboards

You'll see 4 dashboards:
- **API Performance** - Response times, error rates, uptime
- **ML Model Performance** - Inference latency, accuracy
- **Business Metrics** - Active users, feature usage
- **Infrastructure** - CPU, memory, disk usage

---

## 📊 Dashboard Overview

### API Performance Dashboard
**What it shows**: How fast and reliable your APIs are

**Key Panels**:
- Request Rate - How many requests per second
- P95 Latency - 95% of requests complete in X seconds
- Error Rate - Percentage of failed requests
- Service Uptime - Availability percentage

**When to check**: 
- After deploying new code
- When users report slow performance
- During high traffic periods

**Alert Thresholds**:
- 🟡 Warning: P95 latency > 500ms
- 🔴 Critical: Error rate > 1%
- 🔴 Critical: Service down

---

### ML Model Performance Dashboard
**What it shows**: How well your AI models are performing

**Key Panels**:
- Inference Latency - How long predictions take
- Model Accuracy - How accurate predictions are
- Disease Detection Stats - Performance of disease detection
- Crop Recommender Stats - Performance of crop recommendations

**When to check**:
- After retraining models
- When users report incorrect predictions
- During model deployment

**Alert Thresholds**:
- 🟡 Warning: Inference > 2 seconds
- 🟡 Warning: Accuracy < 85%
- 🔴 Critical: Disease detection accuracy < 90%

---

### Business Metrics Dashboard
**What it shows**: How users are engaging with your platform

**Key Panels**:
- Active Users - Current user count (target: 700)
- Disease Detections Today - Daily detection count
- Feature Usage - Which features are most used
- Session Duration - How long users stay in app
- Offline Usage - Percentage of offline sessions

**When to check**:
- Daily for user engagement trends
- Weekly for feature adoption
- Monthly for retention metrics

**Success Targets**:
- ✅ Active Users: 700+ (70% retention)
- ✅ Session Duration: >5 minutes
- ✅ Offline Usage: >40%

---

### Infrastructure Dashboard
**What it shows**: Health of your servers and databases

**Key Panels**:
- CPU Usage - Processor utilization
- Memory Usage - RAM utilization
- Disk Usage - Storage utilization
- Database Connections - Active DB connections
- Redis Memory - Cache memory usage

**When to check**:
- When services are slow
- Before scaling up/down
- During incident response

**Alert Thresholds**:
- 🟡 Warning: CPU > 80%
- 🟡 Warning: Memory > 85%
- 🟡 Warning: Disk > 80%
- 🔴 Critical: Database down

---

## 🔔 Understanding Alerts

### Alert Severity Levels

**🔴 Critical** - Immediate action required
- Service is down
- Database is unreachable
- Error rate is very high

**🟡 Warning** - Attention needed soon
- High latency
- Low accuracy
- Resource usage high

**ℹ️ Info** - Informational
- Low feature usage
- Unusual patterns

### Where to See Alerts

1. **Grafana Dashboards** - Red/yellow indicators on panels
2. **Prometheus Alerts** - http://localhost:9090/alerts
3. **Alertmanager** - http://localhost:9093

### Configuring Notifications

Edit `alertmanager.yml` to add:
- Email notifications
- Slack messages
- PagerDuty alerts
- Webhook integrations

---

## 🔍 Common Scenarios

### Scenario 1: API is Slow
1. Open **API Performance Dashboard**
2. Check **P95 Latency** panel
3. Identify which service/endpoint is slow
4. Check **Infrastructure Dashboard** for resource constraints
5. Review logs for that service

### Scenario 2: Model Accuracy Dropped
1. Open **ML Model Performance Dashboard**
2. Check **Model Accuracy** panel
3. Identify which model has low accuracy
4. Check **Model Errors** table for error types
5. Review recent model deployments

### Scenario 3: Low User Engagement
1. Open **Business Metrics Dashboard**
2. Check **Active Users** stat
3. Review **Feature Usage** graph
4. Check **Session Duration** trends
5. Analyze which features are underused

### Scenario 4: Service is Down
1. Check **API Performance Dashboard** - Service Uptime panel
2. Open **Prometheus** - http://localhost:9090/targets
3. Identify which service is down (red status)
4. Check Docker containers: `docker ps`
5. Review service logs: `docker logs <container-name>`

---

## 🛠️ Troubleshooting

### Dashboards Not Loading
```powershell
# Check if Grafana is running
docker ps | grep grafana

# Check Grafana logs
docker logs krishiai-grafana

# Restart Grafana
docker restart krishiai-grafana
```

### No Data in Panels
```powershell
# Check if Prometheus is scraping targets
# Open: http://localhost:9090/targets
# All targets should show "UP"

# Check if services expose metrics
curl http://localhost:3001/metrics  # auth-service
curl http://localhost:8000/metrics  # crop-service
```

### Alerts Not Firing
```powershell
# Check Prometheus alert rules
# Open: http://localhost:9090/alerts

# Check Alertmanager
# Open: http://localhost:9093

# Verify alert rules are loaded
docker exec krishiai-prometheus promtool check rules /etc/prometheus/alerts/*.yml
```

---

## 📚 Additional Resources

### Documentation
- **Full Implementation Guide**: `TASK_14.4_IMPLEMENTATION.md`
- **Completion Summary**: `TASK_14.4_SUMMARY.md`
- **Verification Script**: `verify-dashboards.ps1`

### External Links
- **Prometheus Docs**: https://prometheus.io/docs/
- **Grafana Docs**: https://grafana.com/docs/
- **PromQL Tutorial**: https://prometheus.io/docs/prometheus/latest/querying/basics/

### Useful Commands

```powershell
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Restart a service
docker restart krishiai-grafana
docker restart krishiai-prometheus

# Check service health
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3000/api/health  # Grafana
curl http://localhost:9093/-/healthy  # Alertmanager

# Verify setup
.\verify-dashboards.ps1
```

---

## 🎯 Success Checklist

Before going to production, verify:

- [ ] All 4 dashboards are accessible in Grafana
- [ ] All panels show data (not "No data")
- [ ] All Prometheus targets are "UP"
- [ ] Alerts are configured and visible
- [ ] Notification channels are configured (email/Slack)
- [ ] Test alerts fire correctly
- [ ] Dashboard refresh rates are appropriate
- [ ] Retention policies are set (30 days default)
- [ ] Backup strategy for Grafana dashboards
- [ ] SSL/TLS enabled for production

---

## 💡 Pro Tips

1. **Bookmark Your Dashboards**: Save direct links to frequently used dashboards
2. **Set Up Alerts**: Configure email/Slack notifications for critical alerts
3. **Use Time Ranges**: Adjust time range (top-right) to zoom in/out
4. **Create Custom Views**: Duplicate dashboards and customize for your needs
5. **Export Dashboards**: Backup your customizations via JSON export
6. **Use Variables**: Add dashboard variables for dynamic filtering
7. **Share Dashboards**: Use Grafana's sharing feature for team collaboration
8. **Monitor Trends**: Look at weekly/monthly trends, not just current values

---

**Need Help?**
- Check the full documentation in `TASK_14.4_IMPLEMENTATION.md`
- Run verification: `.\verify-dashboards.ps1`
- Review Grafana logs: `docker logs krishiai-grafana`
- Check Prometheus targets: http://localhost:9090/targets

**Happy Monitoring! 📊**
