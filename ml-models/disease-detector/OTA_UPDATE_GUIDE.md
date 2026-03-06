# OTA (Over-The-Air) Model Update System

## Overview

The OTA update system allows the KrishiAI mobile app to automatically download and update the disease detection model without requiring an app update. This ensures farmers always have access to the latest and most accurate AI models.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Mobile App                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Model Update Manager                             │  │
│  │  - Check for updates on WiFi                      │  │
│  │  - Download new model                             │  │
│  │  - Verify integrity (SHA256)                      │  │
│  │  - Replace old model                              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│                   CDN (CloudFlare)                       │
│  /models/disease_detector/                              │
│    ├── version_registry.json  (list of all versions)   │
│    ├── v20240115.1430/                                  │
│    │   ├── manifest.json                                │
│    │   ├── disease_detector.tflite                      │
│    │   └── class_indices.json                           │
│    └── v20240120.0900/                                  │
│        ├── manifest.json                                │
│        ├── disease_detector.tflite                      │
│        └── class_indices.json                           │
└─────────────────────────────────────────────────────────┘
```

## Version Registry Format

**File**: `version_registry.json`

```json
{
  "latest_version": "20240120.0900",
  "versions": [
    {
      "version": "20240120.0900",
      "release_date": "2024-01-20T09:00:00",
      "model_size_mb": 11.5,
      "accuracy": 0.9234,
      "manifest_url": "https://cdn.krishiai.com/models/disease_detector/v20240120.0900/manifest.json"
    },
    {
      "version": "20240115.1430",
      "release_date": "2024-01-15T14:30:00",
      "model_size_mb": 12.1,
      "accuracy": 0.9187,
      "manifest_url": "https://cdn.krishiai.com/models/disease_detector/v20240115.1430/manifest.json"
    }
  ]
}
```

## Manifest Format

**File**: `manifest.json` (per version)

```json
{
  "model_version": "20240120.0900",
  "model_type": "disease_detector",
  "release_date": "2024-01-20T09:00:00",
  "model_url": "https://cdn.krishiai.com/models/disease_detector/v20240120.0900/disease_detector.tflite",
  "class_indices_url": "https://cdn.krishiai.com/models/disease_detector/v20240120.0900/class_indices.json",
  "model_hash": "a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
  "model_size_bytes": 12058624,
  "min_app_version": "1.0.0",
  "required": false,
  "changelog": [
    "Improved disease detection accuracy by 2%",
    "Optimized model size for faster downloads",
    "Enhanced support for low-light conditions"
  ],
  "metadata": {
    "version": "20240120.0900",
    "created_at": "2024-01-20T09:00:00",
    "model_hash": "a3f5b8c9d2e1f4a7b6c5d8e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0",
    "model_size_mb": 11.5,
    "model_type": "disease_detector",
    "framework": "tensorflow_lite",
    "input_shape": [224, 224, 3],
    "num_classes": 120,
    "quantization": "float16",
    "target_platform": "android",
    "min_android_version": 26,
    "accuracy": 0.9234
  }
}
```

## Update Flow

### 1. Check for Updates

The mobile app checks for updates:
- **Trigger**: App startup (if WiFi connected)
- **Frequency**: Once per day maximum
- **Condition**: Only on WiFi (to save data)

```typescript
// Mobile app pseudocode
async function checkForModelUpdates() {
  const currentVersion = await getInstalledModelVersion();
  const registryUrl = 'https://cdn.krishiai.com/models/disease_detector/version_registry.json';
  
  const registry = await fetch(registryUrl).then(r => r.json());
  const latestVersion = registry.latest_version;
  
  if (latestVersion > currentVersion) {
    return registry.versions.find(v => v.version === latestVersion);
  }
  
  return null;
}
```

### 2. Download Model

If update available:
- Download manifest first
- Check `min_app_version` compatibility
- Check `required` flag (force update or optional)
- Download model file
- Download class_indices.json

```typescript
async function downloadModelUpdate(versionInfo) {
  // Download manifest
  const manifest = await fetch(versionInfo.manifest_url).then(r => r.json());
  
  // Check compatibility
  if (!isAppVersionCompatible(manifest.min_app_version)) {
    throw new Error('App update required');
  }
  
  // Download model
  const modelBlob = await downloadWithProgress(manifest.model_url);
  
  // Download class indices
  const classIndices = await fetch(manifest.class_indices_url).then(r => r.json());
  
  return { manifest, modelBlob, classIndices };
}
```

### 3. Verify Integrity

Before installing:
- Calculate SHA256 hash of downloaded model
- Compare with `model_hash` in manifest
- Reject if mismatch

```typescript
async function verifyModelIntegrity(modelBlob, expectedHash) {
  const arrayBuffer = await modelBlob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (hashHex !== expectedHash) {
    throw new Error('Model integrity check failed');
  }
}
```

### 4. Install Update

After verification:
- Save new model to app storage
- Update class_indices.json
- Update installed version metadata
- Reload model in TFLite interpreter

```typescript
async function installModelUpdate(modelBlob, classIndices, manifest) {
  // Backup current model
  await backupCurrentModel();
  
  try {
    // Write new model
    await writeModelFile(modelBlob);
    await writeClassIndices(classIndices);
    
    // Update metadata
    await saveInstalledVersion(manifest.model_version);
    
    // Reload model
    await reloadTFLiteModel();
    
    // Delete backup
    await deleteBackup();
  } catch (error) {
    // Rollback on failure
    await restoreBackup();
    throw error;
  }
}
```

## Creating OTA Packages

### Step 1: Train and Convert Model

```bash
# Train model
cd ml-models/disease-detector
python train.py --epochs 50

# Convert to TFLite with OTA package creation
python convert_to_tflite.py --model-path models/disease_detector.h5
```

This creates:
- `models/disease_detector.tflite` - TFLite model
- `models/ota/v{version}/` - OTA package directory
  - `disease_detector.tflite`
  - `class_indices.json`
  - `manifest.json`
- `models/ota/version_registry.json` - Updated registry

### Step 2: Upload to CDN

```bash
# Upload OTA package to CDN (example with AWS S3)
aws s3 sync models/ota/ s3://krishiai-cdn/models/disease_detector/ \
  --acl public-read \
  --cache-control "max-age=86400"

# Invalidate CloudFlare cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://cdn.krishiai.com/models/disease_detector/version_registry.json"]}'
```

### Step 3: Test Update

```bash
# Test manifest accessibility
curl https://cdn.krishiai.com/models/disease_detector/version_registry.json

# Test model download
curl -I https://cdn.krishiai.com/models/disease_detector/v{version}/disease_detector.tflite
```

## Mobile App Integration

### Model Update Manager Service

Create `src/services/modelUpdateService.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';

const REGISTRY_URL = 'https://cdn.krishiai.com/models/disease_detector/version_registry.json';
const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/disease_detector.tflite`;
const VERSION_KEY = 'disease_detector_version';

export class ModelUpdateManager {
  async checkForUpdates(): Promise<UpdateInfo | null> {
    // Only check on WiFi
    const netInfo = await NetInfo.fetch();
    if (netInfo.type !== 'wifi') {
      return null;
    }
    
    const currentVersion = await this.getInstalledVersion();
    const registry = await fetch(REGISTRY_URL).then(r => r.json());
    
    if (registry.latest_version > currentVersion) {
      return registry.versions.find(v => v.version === registry.latest_version);
    }
    
    return null;
  }
  
  async downloadAndInstall(updateInfo: UpdateInfo): Promise<void> {
    // Download manifest
    const manifest = await fetch(updateInfo.manifest_url).then(r => r.json());
    
    // Download model with progress
    const downloadResult = await RNFS.downloadFile({
      fromUrl: manifest.model_url,
      toFile: `${MODEL_PATH}.tmp`,
      progressDivider: 10,
      progress: (res) => {
        const progress = res.bytesWritten / res.contentLength;
        this.onProgress?.(progress);
      }
    }).promise;
    
    // Verify hash
    const hash = await RNFS.hash(`${MODEL_PATH}.tmp`, 'sha256');
    if (hash !== manifest.model_hash) {
      throw new Error('Hash mismatch');
    }
    
    // Replace model
    await RNFS.moveFile(`${MODEL_PATH}.tmp`, MODEL_PATH);
    
    // Update version
    await AsyncStorage.setItem(VERSION_KEY, manifest.model_version);
  }
  
  async getInstalledVersion(): Promise<string> {
    return await AsyncStorage.getItem(VERSION_KEY) || '0.0.0';
  }
}
```

### Usage in App

```typescript
// In App.tsx or main component
import { ModelUpdateManager } from './services/modelUpdateService';

const updateManager = new ModelUpdateManager();

useEffect(() => {
  const checkUpdates = async () => {
    const update = await updateManager.checkForUpdates();
    
    if (update) {
      Alert.alert(
        'Model Update Available',
        `New disease detection model (v${update.version}) is available. Download now?`,
        [
          { text: 'Later', style: 'cancel' },
          { 
            text: 'Download', 
            onPress: async () => {
              try {
                await updateManager.downloadAndInstall(update);
                Alert.alert('Success', 'Model updated successfully');
              } catch (error) {
                Alert.alert('Error', 'Failed to update model');
              }
            }
          }
        ]
      );
    }
  };
  
  checkUpdates();
}, []);
```

## Security Considerations

### 1. HTTPS Only
- All downloads must use HTTPS
- Prevent man-in-the-middle attacks

### 2. Hash Verification
- Always verify SHA256 hash
- Reject models with mismatched hashes

### 3. Version Validation
- Check `min_app_version` compatibility
- Prevent incompatible model installation

### 4. Rollback Capability
- Backup current model before update
- Restore on installation failure

### 5. CDN Security
- Use signed URLs for sensitive models (if needed)
- Implement rate limiting on CDN

## Monitoring and Analytics

Track OTA update metrics:

```typescript
// Track update events
analytics.track('model_update_available', {
  current_version: currentVersion,
  new_version: newVersion,
  model_size_mb: updateInfo.model_size_mb
});

analytics.track('model_update_started', {
  version: newVersion
});

analytics.track('model_update_completed', {
  version: newVersion,
  download_time_seconds: downloadTime,
  success: true
});

analytics.track('model_update_failed', {
  version: newVersion,
  error: error.message
});
```

## Troubleshooting

### Update Not Detected
- Check WiFi connection
- Verify registry URL is accessible
- Check last update check timestamp

### Download Fails
- Check network connectivity
- Verify CDN is accessible
- Check available storage space

### Hash Mismatch
- Re-download model
- Verify CDN file integrity
- Check for corrupted upload

### Model Not Loading
- Verify TFLite model format
- Check Android version compatibility
- Restore backup model

## Best Practices

1. **Test Before Release**: Always test OTA packages on multiple devices before production release
2. **Gradual Rollout**: Release to 10% → 50% → 100% of users
3. **Monitor Metrics**: Track update success rate, download times, and errors
4. **Backup Strategy**: Always backup current model before update
5. **Rollback Plan**: Have ability to rollback to previous version if issues detected
6. **User Communication**: Clearly communicate update benefits in changelog
7. **WiFi Only**: Default to WiFi-only downloads to save user data
8. **Optional Updates**: Make updates optional unless critical bug fix

## Future Enhancements

- **Delta Updates**: Only download changed model layers
- **A/B Testing**: Test new models with subset of users
- **Automatic Rollback**: Detect accuracy drops and auto-rollback
- **Compression**: Use gzip compression for faster downloads
- **Background Updates**: Download in background without user interaction
- **Update Scheduling**: Schedule updates during off-peak hours

## References

- TensorFlow Lite: https://www.tensorflow.org/lite
- Model Optimization: https://www.tensorflow.org/lite/performance/model_optimization
- Android Asset Management: https://developer.android.com/guide/topics/resources/providing-resources
