/**
 * Image Compression Utility
 * 
 * Provides client-side image compression before upload to minimize data usage.
 * 
 * Features:
 * - Resize images to max 800x800 pixels
 * - Convert to WebP format with 80% quality
 * - Compress before upload to reduce bandwidth
 * - Support for lazy loading with thumbnails
 * 
 * Requirements: 16.6 (Compatibility - data compression)
 * Task: 12.3 (Implement image optimization)
 */

import ImageResizer from 'react-native-image-resizer';
import { Platform } from 'react-native';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'JPEG' | 'PNG' | 'WEBP';
  rotation?: number;
}

export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
  size: number;
  name?: string;
  type?: string;
}

export interface CompressionMetadata {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
}

/**
 * Default compression settings optimized for disease detection images
 */
const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 80,
  format: 'WEBP',
  rotation: 0,
};

/**
 * Thumbnail settings for lazy loading
 */
const THUMBNAIL_OPTIONS: CompressionOptions = {
  maxWidth: 200,
  maxHeight: 200,
  quality: 70,
  format: 'WEBP',
  rotation: 0,
};

/**
 * Compress an image for upload
 * 
 * @param imageUri - Local file URI of the image
 * @param options - Compression options (optional)
 * @returns Compressed image result
 */
export async function compressImage(
  imageUri: string,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  try {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Use WebP on Android, JPEG on iOS (WebP support varies)
    const format = Platform.OS === 'android' ? 'WEBP' : 'JPEG';
    
    const result = await ImageResizer.createResizedImage(
      imageUri,
      opts.maxWidth!,
      opts.maxHeight!,
      format,
      opts.quality!,
      opts.rotation,
      undefined, // outputPath (auto-generated)
      false, // keepMeta
      {
        mode: 'contain', // Maintain aspect ratio
        onlyScaleDown: true, // Don't upscale small images
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      size: result.size || 0,
      name: result.name,
      type: format === 'WEBP' ? 'image/webp' : 'image/jpeg',
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    throw new Error(`Failed to compress image: ${error}`);
  }
}

/**
 * Compress an image for disease detection
 * Optimized settings for plant disease images
 * 
 * @param imageUri - Local file URI of the captured plant image
 * @returns Compressed image result
 */
export async function compressDiseaseDetectionImage(
  imageUri: string
): Promise<CompressionResult> {
  return compressImage(imageUri, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
    format: 'WEBP',
  });
}

/**
 * Create a thumbnail for lazy loading
 * 
 * @param imageUri - Local file URI of the image
 * @returns Thumbnail image result
 */
export async function createThumbnail(
  imageUri: string
): Promise<CompressionResult> {
  return compressImage(imageUri, THUMBNAIL_OPTIONS);
}

/**
 * Compress multiple images in batch
 * 
 * @param imageUris - Array of local file URIs
 * @param options - Compression options (optional)
 * @returns Array of compressed image results
 */
export async function compressImageBatch(
  imageUris: string[],
  options: CompressionOptions = {}
): Promise<CompressionResult[]> {
  const compressionPromises = imageUris.map(uri => 
    compressImage(uri, options)
  );
  
  return Promise.all(compressionPromises);
}

/**
 * Get compression metadata for analytics
 * 
 * @param originalUri - Original image URI
 * @param compressedResult - Compressed image result
 * @returns Compression metadata
 */
export async function getCompressionMetadata(
  originalUri: string,
  compressedResult: CompressionResult
): Promise<CompressionMetadata> {
  try {
    // Get original image info
    const originalInfo = await ImageResizer.createResizedImage(
      originalUri,
      10000, // Large max to get original dimensions
      10000,
      'JPEG',
      100,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true }
    );

    const originalSize = originalInfo.size || 0;
    const compressedSize = compressedResult.size;
    const compressionRatio = originalSize > 0 
      ? ((originalSize - compressedSize) / originalSize) * 100 
      : 0;

    return {
      originalSize,
      compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      originalDimensions: {
        width: originalInfo.width,
        height: originalInfo.height,
      },
      compressedDimensions: {
        width: compressedResult.width,
        height: compressedResult.height,
      },
    };
  } catch (error) {
    console.error('Failed to get compression metadata:', error);
    throw error;
  }
}

/**
 * Validate image before compression
 * 
 * @param imageUri - Local file URI
 * @param maxSizeMB - Maximum allowed file size in MB
 * @returns True if valid, false otherwise
 */
export async function validateImage(
  imageUri: string,
  maxSizeMB: number = 10
): Promise<boolean> {
  try {
    // Get image info without resizing
    const info = await ImageResizer.createResizedImage(
      imageUri,
      10000,
      10000,
      'JPEG',
      100,
      0,
      undefined,
      false,
      { mode: 'contain', onlyScaleDown: true }
    );

    const sizeMB = (info.size || 0) / (1024 * 1024);
    
    if (sizeMB > maxSizeMB) {
      console.warn(`Image too large: ${sizeMB.toFixed(2)}MB (max ${maxSizeMB}MB)`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Image validation failed:', error);
    return false;
  }
}

/**
 * Calculate estimated data usage for image upload
 * 
 * @param imageSize - Image size in bytes
 * @returns Estimated data usage in MB
 */
export function estimateDataUsage(imageSize: number): number {
  // Add overhead for HTTP headers, base64 encoding, etc. (~33% for base64)
  const overhead = 1.33;
  return (imageSize * overhead) / (1024 * 1024);
}

/**
 * Format file size for display
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Compress image with progress callback
 * Useful for showing compression progress in UI
 * 
 * @param imageUri - Local file URI
 * @param options - Compression options
 * @param onProgress - Progress callback (0-100)
 * @returns Compressed image result
 */
export async function compressImageWithProgress(
  imageUri: string,
  options: CompressionOptions = {},
  onProgress?: (progress: number) => void
): Promise<CompressionResult> {
  try {
    // Simulate progress (actual compression is fast)
    if (onProgress) {
      onProgress(0);
      setTimeout(() => onProgress(30), 50);
      setTimeout(() => onProgress(60), 100);
    }

    const result = await compressImage(imageUri, options);

    if (onProgress) {
      onProgress(100);
    }

    return result;
  } catch (error) {
    console.error('Image compression with progress failed:', error);
    throw error;
  }
}

/**
 * Auto-compress image based on network conditions
 * Uses higher compression on slow networks
 * 
 * @param imageUri - Local file URI
 * @param networkType - Network type ('wifi', '4g', '3g', '2g', 'none')
 * @returns Compressed image result
 */
export async function autoCompressImage(
  imageUri: string,
  networkType: string
): Promise<CompressionResult> {
  let quality = 80;
  let maxSize = 800;

  // Adjust compression based on network
  switch (networkType) {
    case 'wifi':
      quality = 85;
      maxSize = 1024;
      break;
    case '4g':
      quality = 80;
      maxSize = 800;
      break;
    case '3g':
      quality = 70;
      maxSize = 640;
      break;
    case '2g':
      quality = 60;
      maxSize = 480;
      break;
    default:
      quality = 80;
      maxSize = 800;
  }

  return compressImage(imageUri, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    quality,
  });
}

export default {
  compressImage,
  compressDiseaseDetectionImage,
  createThumbnail,
  compressImageBatch,
  getCompressionMetadata,
  validateImage,
  estimateDataUsage,
  formatFileSize,
  compressImageWithProgress,
  autoCompressImage,
};
