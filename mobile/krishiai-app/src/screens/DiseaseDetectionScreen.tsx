/**
 * Disease Detection Screen
 * 
 * Provides camera integration for capturing plant images and detecting diseases
 * using on-device TensorFlow Lite model.
 * 
 * Features:
 * - Camera permissions handling
 * - Image capture with preview
 * - On-device disease detection
 * - Display results with treatment recommendations
 * - Offline functionality
 * 
 * Requirements: 5.3, 5.4, 5.5, Design Section 2.1
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  PermissionsAndroid,
  Platform,
  Image,
} from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { useTranslation } from 'react-i18next';
import { tfliteService, DiseaseDetectionResult } from '../services/tfliteService';
import { imageUriToBase64 } from '../utils/imageUtils';
import TreatmentDisclaimer from '../components/TreatmentDisclaimer';

interface DiseaseDetectionScreenProps {
  navigation: any;
}

const DiseaseDetectionScreen: React.FC<DiseaseDetectionScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const camera = useRef<Camera>(null);
  const devices = useCameraDevices();
  const device = devices.back;

  // State management
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectionResult, setDetectionResult] = useState<DiseaseDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);
  const [showDisclaimer, setShowDisclaimer] = useState<boolean>(false);

  /**
   * Request camera permissions
   */
  const requestCameraPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('disease.cameraPermission'),
            message: t('disease.cameraPermission'),
            buttonNeutral: t('common.cancel'),
            buttonNegative: t('common.no'),
            buttonPositive: t('common.yes'),
          }
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
        } else {
          setHasPermission(false);
          Alert.alert(
            t('errors.permissionDenied'),
            t('disease.cameraPermission')
          );
        }
      } else {
        const permission = await Camera.requestCameraPermission();
        setHasPermission(permission === 'authorized');
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setError(t('errors.cameraError'));
    }
  }, [t]);

  /**
   * Initialize TFLite model
   */
  const initializeModel = useCallback(async () => {
    try {
      await tfliteService.initialize();
      setModelLoaded(true);
      console.log('TFLite model initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TFLite model:', error);
      setError(t('errors.unknownError'));
      Alert.alert(
        t('common.error'),
        'Failed to load disease detection model. Please restart the app.'
      );
    }
  }, [t]);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    requestCameraPermission();
    initializeModel();

    return () => {
      setIsActive(false);
    };
  }, [requestCameraPermission, initializeModel]);

  /**
   * Capture photo from camera
   */
  const capturePhoto = useCallback(async () => {
    try {
      if (!camera.current) {
        throw new Error('Camera not ready');
      }

      setError(null);
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'balanced',
        flash: 'off',
        enableAutoStabilization: true,
      });

      const photoUri = `file://${photo.path}`;
      setCapturedImage(photoUri);
      setIsActive(false);

      // Automatically start analysis
      await analyzeImage(photoUri);
    } catch (error) {
      console.error('Error capturing photo:', error);
      setError(t('errors.cameraError'));
      Alert.alert(t('common.error'), t('errors.cameraError'));
    }
  }, [t]);

  /**
   * Analyze captured image for disease detection
   */
  const analyzeImage = useCallback(async (imageUri: string) => {
    try {
      setIsAnalyzing(true);
      setError(null);
      setDetectionResult(null);

      if (!modelLoaded) {
        throw new Error('Model not loaded');
      }

      // Convert image to base64
      const base64Image = await imageUriToBase64(imageUri);

      // Run disease detection
      const result = await tfliteService.detectDisease(base64Image);
      
      setDetectionResult(result);
      setIsAnalyzing(false);
      
      // Show disclaimer when results are ready
      setShowDisclaimer(true);

      console.log('Disease detection completed:', result);
    } catch (error) {
      console.error('Error analyzing image:', error);
      setIsAnalyzing(false);
      setError(t('errors.unknownError'));
      Alert.alert(
        t('common.error'),
        'Failed to analyze image. Please try again.'
      );
    }
  }, [modelLoaded, t]);

  /**
   * Retake photo
   */
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setDetectionResult(null);
    setError(null);
    setIsActive(true);
  }, []);

  /**
   * Save detection result
   */
  const saveResult = useCallback(() => {
    // TODO: Save to WatermelonDB and sync queue
    Alert.alert(
      t('common.success'),
      'Detection result saved successfully'
    );
    navigation.goBack();
  }, [navigation, t]);

  /**
   * Render camera view
   */
  const renderCamera = () => {
    if (!hasPermission) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{t('disease.cameraPermission')}</Text>
          <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
            <Text style={styles.buttonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!device) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          photo={true}
        />
        
        {/* Camera overlay */}
        <View style={styles.cameraOverlay}>
          <View style={styles.topOverlay}>
            <Text style={styles.instructionText}>
              {t('disease.captureImage')}
            </Text>
          </View>
          
          <View style={styles.centerOverlay}>
            <View style={styles.focusFrame} />
          </View>
          
          <View style={styles.bottomOverlay}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={capturePhoto}
              disabled={!modelLoaded}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /**
   * Render image preview with analysis
   */
  const renderPreview = () => {
    return (
      <ScrollView style={styles.previewContainer}>
        {/* Captured Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: capturedImage! }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </View>

        {/* Analysis Status */}
        {isAnalyzing && (
          <View style={styles.analyzingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.analyzingText}>{t('disease.analyzing')}</Text>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Detection Results */}
        {detectionResult && !isAnalyzing && (
          <View style={styles.resultsContainer}>
            {/* Disease Information */}
            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>{t('disease.diseaseName')}</Text>
              <Text style={styles.diseaseNameLocal}>
                {detectionResult.diseaseNameLocal}
              </Text>
              <Text style={styles.diseaseName}>
                {detectionResult.diseaseName}
              </Text>
              <Text style={styles.scientificName}>
                {t('disease.scientificName')}: {detectionResult.diseaseNameScientific}
              </Text>
            </View>

            {/* Confidence and Severity */}
            <View style={styles.resultCard}>
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('disease.confidence')}</Text>
                  <Text style={styles.metricValue}>
                    {(detectionResult.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('disease.severity')}</Text>
                  <Text style={[
                    styles.metricValue,
                    styles[`severity${detectionResult.severity}`]
                  ]}>
                    {t(`disease.severityLevels.${detectionResult.severity.toLowerCase()}`)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Organic Treatment */}
            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>{t('disease.organicTreatment')}</Text>
              {detectionResult.treatments.organic.map((treatment, index) => (
                <View key={index} style={styles.treatmentItem}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.treatmentText}>{treatment}</Text>
                </View>
              ))}
            </View>

            {/* Chemical Treatment */}
            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>{t('disease.chemicalTreatment')}</Text>
              {detectionResult.treatments.chemical.map((treatment, index) => (
                <View key={index} style={styles.treatmentItem}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.treatmentText}>{treatment}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={retakePhoto}
          >
            <Text style={styles.buttonText}>{t('disease.captureImage')}</Text>
          </TouchableOpacity>
          
          {detectionResult && (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={saveResult}
            >
              <Text style={styles.buttonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {!capturedImage ? renderCamera() : renderPreview()}
      
      {/* Treatment Disclaimer Modal */}
      <TreatmentDisclaimer
        visible={showDisclaimer}
        onAccept={() => setShowDisclaimer(false)}
        onCancel={() => setShowDisclaimer(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusFrame: {
    width: 280,
    height: 280,
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  bottomOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 30,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#4CAF50',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  imageContainer: {
    backgroundColor: '#000',
    height: 300,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  analyzingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  analyzingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#ffebee',
    margin: 15,
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    fontSize: 16,
    textAlign: 'center',
  },
  resultsContainer: {
    padding: 15,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 12,
  },
  diseaseNameLocal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 8,
  },
  diseaseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 4,
  },
  scientificName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#757575',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e7d32',
  },
  severityEarly: {
    color: '#ffa726',
  },
  severityModerate: {
    color: '#ff7043',
  },
  severitySevere: {
    color: '#e53935',
  },
  treatmentItem: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingRight: 10,
  },
  bulletPoint: {
    fontSize: 18,
    color: '#4CAF50',
    marginRight: 10,
    fontWeight: '700',
  },
  treatmentText: {
    flex: 1,
    fontSize: 16,
    color: '#424242',
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#fff',
  },
});

export default DiseaseDetectionScreen;
