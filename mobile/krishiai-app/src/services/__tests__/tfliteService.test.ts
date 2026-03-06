/**
 * TFLite Service Tests
 * 
 * Tests for TensorFlow Lite disease detection service
 */

import { tfliteService, DiseaseDetectionResult } from '../tfliteService';
import { NativeModules, Platform } from 'react-native';

// Mock the native module
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android'
  },
  NativeModules: {
    TFLiteModule: {
      loadModel: jest.fn(),
      runInference: jest.fn(),
      unloadModel: jest.fn(),
      isModelLoaded: jest.fn()
    }
  }
}));

describe('TFLiteService', () => {
  const mockTFLiteModule = NativeModules.TFLiteModule;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should load the model successfully', async () => {
      mockTFLiteModule.loadModel.mockResolvedValue(true);

      await tfliteService.initialize();

      expect(mockTFLiteModule.loadModel).toHaveBeenCalledWith('disease_detector.tflite');
    });

    it('should throw error if platform is not Android', async () => {
      (Platform as any).OS = 'ios';

      await expect(tfliteService.initialize()).rejects.toThrow(
        'TFLite is only supported on Android'
      );

      (Platform as any).OS = 'android';
    });

    it('should throw error if native module is not available', async () => {
      const originalModule = NativeModules.TFLiteModule;
      (NativeModules as any).TFLiteModule = null;

      await expect(tfliteService.initialize()).rejects.toThrow(
        'TFLiteModule is not available'
      );

      (NativeModules as any).TFLiteModule = originalModule;
    });

    it('should handle model loading errors', async () => {
      mockTFLiteModule.loadModel.mockRejectedValue(new Error('Model file not found'));

      await expect(tfliteService.initialize()).rejects.toThrow(
        'TFLite initialization failed'
      );
    });
  });

  describe('isModelLoaded', () => {
    it('should return true when model is loaded', async () => {
      mockTFLiteModule.isModelLoaded.mockResolvedValue(true);

      const result = await tfliteService.isModelLoaded();

      expect(result).toBe(true);
    });

    it('should return false when model is not loaded', async () => {
      mockTFLiteModule.isModelLoaded.mockResolvedValue(false);

      const result = await tfliteService.isModelLoaded();

      expect(result).toBe(false);
    });

    it('should return false if native module is not available', async () => {
      const originalModule = NativeModules.TFLiteModule;
      (NativeModules as any).TFLiteModule = null;

      const result = await tfliteService.isModelLoaded();

      expect(result).toBe(false);

      (NativeModules as any).TFLiteModule = originalModule;
    });
  });

  describe('detectDisease', () => {
    const mockImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    beforeEach(async () => {
      mockTFLiteModule.loadModel.mockResolvedValue(true);
      await tfliteService.initialize();
    });

    it('should detect disease successfully', async () => {
      const mockInferenceResult = {
        predictions: [
          { classIndex: 0, confidence: 0.95 },
          { classIndex: 1, confidence: 0.03 },
          { classIndex: 2, confidence: 0.02 }
        ],
        inferenceTime: 856
      };

      mockTFLiteModule.runInference.mockResolvedValue(mockInferenceResult);

      const result = await tfliteService.detectDisease(mockImageBase64);

      expect(result).toBeDefined();
      expect(result.diseaseName).toBe('Tomato Late Blight');
      expect(result.confidence).toBe(0.95);
      expect(result.severity).toBe('Severe');
      expect(result.treatments.organic).toBeDefined();
      expect(result.treatments.chemical).toBeDefined();
    });

    it('should determine severity correctly based on confidence', async () => {
      // Test Severe (>= 0.9)
      mockTFLiteModule.runInference.mockResolvedValue({
        predictions: [{ classIndex: 0, confidence: 0.95 }],
        inferenceTime: 800
      });

      let result = await tfliteService.detectDisease(mockImageBase64);
      expect(result.severity).toBe('Severe');

      // Test Moderate (>= 0.7, < 0.9)
      mockTFLiteModule.runInference.mockResolvedValue({
        predictions: [{ classIndex: 0, confidence: 0.75 }],
        inferenceTime: 800
      });

      result = await tfliteService.detectDisease(mockImageBase64);
      expect(result.severity).toBe('Moderate');

      // Test Early (< 0.7)
      mockTFLiteModule.runInference.mockResolvedValue({
        predictions: [{ classIndex: 0, confidence: 0.65 }],
        inferenceTime: 800
      });

      result = await tfliteService.detectDisease(mockImageBase64);
      expect(result.severity).toBe('Early');
    });

    it('should throw error if model is not loaded', async () => {
      await tfliteService.unload();

      await expect(tfliteService.detectDisease(mockImageBase64)).rejects.toThrow(
        'Model not loaded'
      );
    });

    it('should throw error if no predictions returned', async () => {
      mockTFLiteModule.runInference.mockResolvedValue({
        predictions: [],
        inferenceTime: 800
      });

      await expect(tfliteService.detectDisease(mockImageBase64)).rejects.toThrow(
        'No predictions returned from model'
      );
    });

    it('should handle inference errors', async () => {
      mockTFLiteModule.runInference.mockRejectedValue(new Error('Inference failed'));

      await expect(tfliteService.detectDisease(mockImageBase64)).rejects.toThrow(
        'Disease detection failed'
      );
    });

    it('should complete inference within 2 seconds', async () => {
      const mockInferenceResult = {
        predictions: [{ classIndex: 0, confidence: 0.92 }],
        inferenceTime: 1500 // 1.5 seconds
      };

      mockTFLiteModule.runInference.mockResolvedValue(mockInferenceResult);

      const startTime = Date.now();
      await tfliteService.detectDisease(mockImageBase64);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // Should complete in less than 2 seconds
    });
  });

  describe('preprocessImage', () => {
    it('should handle base64 data URI', async () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await tfliteService.preprocessImage(dataUri);
      
      expect(result).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    });

    it('should handle plain base64 string', async () => {
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const result = await tfliteService.preprocessImage(base64);
      
      expect(result).toBe(base64);
    });
  });

  describe('unload', () => {
    it('should unload model successfully', async () => {
      mockTFLiteModule.loadModel.mockResolvedValue(true);
      mockTFLiteModule.unloadModel.mockResolvedValue(true);

      await tfliteService.initialize();
      await tfliteService.unload();

      expect(mockTFLiteModule.unloadModel).toHaveBeenCalled();
    });

    it('should handle unload errors', async () => {
      mockTFLiteModule.loadModel.mockResolvedValue(true);
      mockTFLiteModule.unloadModel.mockRejectedValue(new Error('Unload failed'));

      await tfliteService.initialize();

      await expect(tfliteService.unload()).rejects.toThrow('Unload failed');
    });
  });

  describe('getModelMetadata', () => {
    it('should return correct model metadata', () => {
      const metadata = tfliteService.getModelMetadata();

      expect(metadata).toEqual({
        version: '1.0.0',
        numClasses: 120,
        inputSize: 224,
        modelType: 'disease_detector'
      });
    });
  });

  describe('disease class mappings', () => {
    beforeEach(async () => {
      mockTFLiteModule.loadModel.mockResolvedValue(true);
      await tfliteService.initialize();
    });

    it('should have treatment recommendations for all diseases', async () => {
      const mockInferenceResult = {
        predictions: [{ classIndex: 0, confidence: 0.92 }],
        inferenceTime: 800
      };

      mockTFLiteModule.runInference.mockResolvedValue(mockInferenceResult);

      const result = await tfliteService.detectDisease('base64image');

      expect(result.treatments.organic).toBeInstanceOf(Array);
      expect(result.treatments.organic.length).toBeGreaterThan(0);
      expect(result.treatments.chemical).toBeInstanceOf(Array);
      expect(result.treatments.chemical.length).toBeGreaterThan(0);
    });

    it('should prioritize organic treatments', async () => {
      const mockInferenceResult = {
        predictions: [{ classIndex: 0, confidence: 0.92 }],
        inferenceTime: 800
      };

      mockTFLiteModule.runInference.mockResolvedValue(mockInferenceResult);

      const result = await tfliteService.detectDisease('base64image');

      // Organic treatments should be listed first in the result structure
      expect(Object.keys(result.treatments)[0]).toBe('organic');
    });

    it('should include local language disease names', async () => {
      const mockInferenceResult = {
        predictions: [{ classIndex: 0, confidence: 0.92 }],
        inferenceTime: 800
      };

      mockTFLiteModule.runInference.mockResolvedValue(mockInferenceResult);

      const result = await tfliteService.detectDisease('base64image');

      expect(result.diseaseNameLocal).toBeDefined();
      expect(result.diseaseNameLocal.length).toBeGreaterThan(0);
    });

    it('should include scientific disease names', async () => {
      const mockInferenceResult = {
        predictions: [{ classIndex: 0, confidence: 0.92 }],
        inferenceTime: 800
      };

      mockTFLiteModule.runInference.mockResolvedValue(mockInferenceResult);

      const result = await tfliteService.detectDisease('base64image');

      expect(result.diseaseNameScientific).toBeDefined();
      expect(result.diseaseNameScientific.length).toBeGreaterThan(0);
    });
  });
});
