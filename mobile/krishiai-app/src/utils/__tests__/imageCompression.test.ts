/**
 * Tests for Image Compression Utility
 */

import ImageResizer from 'react-native-image-resizer';
import {
  compressImage,
  compressDiseaseDetectionImage,
  createThumbnail,
  compressImageBatch,
  validateImage,
  estimateDataUsage,
  formatFileSize,
  autoCompressImage,
} from '../imageCompression';

// Mock react-native-image-resizer
jest.mock('react-native-image-resizer', () => ({
  createResizedImage: jest.fn(),
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

describe('Image Compression Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('compressImage', () => {
    it('should compress image with default options', async () => {
      const mockResult = {
        uri: 'file://compressed.webp',
        width: 800,
        height: 600,
        size: 50000,
        name: 'compressed.webp',
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      const result = await compressImage('file://original.jpg');

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://original.jpg',
        800,
        800,
        'WEBP',
        80,
        0,
        undefined,
        false,
        {
          mode: 'contain',
          onlyScaleDown: true,
        }
      );

      expect(result).toEqual({
        uri: mockResult.uri,
        width: mockResult.width,
        height: mockResult.height,
        size: mockResult.size,
        name: mockResult.name,
        type: 'image/webp',
      });
    });

    it('should compress image with custom options', async () => {
      const mockResult = {
        uri: 'file://compressed.jpg',
        width: 640,
        height: 480,
        size: 40000,
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      await compressImage('file://original.jpg', {
        maxWidth: 640,
        maxHeight: 480,
        quality: 70,
      });

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://original.jpg',
        640,
        480,
        'WEBP',
        70,
        0,
        undefined,
        false,
        expect.any(Object)
      );
    });

    it('should handle compression errors', async () => {
      (ImageResizer.createResizedImage as jest.Mock).mockRejectedValue(
        new Error('Compression failed')
      );

      await expect(compressImage('file://invalid.jpg')).rejects.toThrow(
        'Failed to compress image'
      );
    });
  });

  describe('compressDiseaseDetectionImage', () => {
    it('should compress with disease detection settings', async () => {
      const mockResult = {
        uri: 'file://disease.webp',
        width: 800,
        height: 800,
        size: 60000,
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      const result = await compressDiseaseDetectionImage('file://plant.jpg');

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://plant.jpg',
        800,
        800,
        'WEBP',
        80,
        0,
        undefined,
        false,
        expect.any(Object)
      );

      expect(result.width).toBe(800);
      expect(result.height).toBe(800);
    });
  });

  describe('createThumbnail', () => {
    it('should create thumbnail with reduced size', async () => {
      const mockResult = {
        uri: 'file://thumb.webp',
        width: 200,
        height: 150,
        size: 10000,
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      const result = await createThumbnail('file://original.jpg');

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://original.jpg',
        200,
        200,
        'WEBP',
        70,
        0,
        undefined,
        false,
        expect.any(Object)
      );

      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });
  });

  describe('compressImageBatch', () => {
    it('should compress multiple images', async () => {
      const mockResults = [
        { uri: 'file://1.webp', width: 800, height: 600, size: 50000 },
        { uri: 'file://2.webp', width: 800, height: 600, size: 55000 },
      ];

      (ImageResizer.createResizedImage as jest.Mock)
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1]);

      const results = await compressImageBatch([
        'file://1.jpg',
        'file://2.jpg',
      ]);

      expect(results).toHaveLength(2);
      expect(ImageResizer.createResizedImage).toHaveBeenCalledTimes(2);
    });

    it('should handle batch compression errors', async () => {
      (ImageResizer.createResizedImage as jest.Mock)
        .mockResolvedValueOnce({ uri: 'file://1.webp', width: 800, height: 600, size: 50000 })
        .mockRejectedValueOnce(new Error('Failed'));

      await expect(
        compressImageBatch(['file://1.jpg', 'file://2.jpg'])
      ).rejects.toThrow();
    });
  });

  describe('validateImage', () => {
    it('should validate image within size limit', async () => {
      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue({
        uri: 'file://test.jpg',
        width: 1000,
        height: 800,
        size: 5 * 1024 * 1024, // 5MB
      });

      const isValid = await validateImage('file://test.jpg', 10);

      expect(isValid).toBe(true);
    });

    it('should reject image exceeding size limit', async () => {
      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue({
        uri: 'file://large.jpg',
        width: 4000,
        height: 3000,
        size: 15 * 1024 * 1024, // 15MB
      });

      const isValid = await validateImage('file://large.jpg', 10);

      expect(isValid).toBe(false);
    });

    it('should handle validation errors', async () => {
      (ImageResizer.createResizedImage as jest.Mock).mockRejectedValue(
        new Error('Invalid image')
      );

      const isValid = await validateImage('file://invalid.jpg');

      expect(isValid).toBe(false);
    });
  });

  describe('estimateDataUsage', () => {
    it('should calculate data usage with overhead', () => {
      const imageSize = 1024 * 1024; // 1MB
      const usage = estimateDataUsage(imageSize);

      // Should be ~1.33MB due to base64 overhead
      expect(usage).toBeCloseTo(1.33, 2);
    });

    it('should handle zero size', () => {
      const usage = estimateDataUsage(0);
      expect(usage).toBe(0);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('autoCompressImage', () => {
    it('should use high quality for WiFi', async () => {
      const mockResult = {
        uri: 'file://compressed.webp',
        width: 1024,
        height: 768,
        size: 80000,
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      await autoCompressImage('file://original.jpg', 'wifi');

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://original.jpg',
        1024,
        1024,
        'WEBP',
        85,
        0,
        undefined,
        false,
        expect.any(Object)
      );
    });

    it('should use medium quality for 4G', async () => {
      const mockResult = {
        uri: 'file://compressed.webp',
        width: 800,
        height: 600,
        size: 60000,
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      await autoCompressImage('file://original.jpg', '4g');

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://original.jpg',
        800,
        800,
        'WEBP',
        80,
        0,
        undefined,
        false,
        expect.any(Object)
      );
    });

    it('should use low quality for 2G', async () => {
      const mockResult = {
        uri: 'file://compressed.webp',
        width: 480,
        height: 360,
        size: 30000,
      };

      (ImageResizer.createResizedImage as jest.Mock).mockResolvedValue(mockResult);

      await autoCompressImage('file://original.jpg', '2g');

      expect(ImageResizer.createResizedImage).toHaveBeenCalledWith(
        'file://original.jpg',
        480,
        480,
        'WEBP',
        60,
        0,
        undefined,
        false,
        expect.any(Object)
      );
    });
  });
});
