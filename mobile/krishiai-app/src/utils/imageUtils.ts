/**
 * Image Utilities
 * 
 * Helper functions for image preprocessing and manipulation
 * for disease detection
 */

/**
 * Convert image URI to base64
 * @param uri Image URI (file:// or content://)
 * @returns Base64 encoded image string
 */
export const imageUriToBase64 = async (uri: string): Promise<string> => {
  try {
    // For React Native, we can use fetch to read local files
    const response = await fetch(uri);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64 = base64data.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    throw error;
  }
};

/**
 * Validate image file
 * @param uri Image URI
 * @returns true if valid image
 */
export const validateImage = (uri: string): boolean => {
  if (!uri) {
    return false;
  }
  
  // Check if it's a valid URI format
  const validPrefixes = ['file://', 'content://', 'data:image', 'http://', 'https://'];
  return validPrefixes.some(prefix => uri.startsWith(prefix));
};

/**
 * Get image dimensions
 * @param uri Image URI
 * @returns Promise with width and height
 */
export const getImageDimensions = (uri: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = uri;
    } else {
      // Fallback for React Native environment
      resolve({ width: 0, height: 0 });
    }
  });
};

/**
 * Compress image quality
 * This is a placeholder - actual implementation would use native modules
 * or libraries like react-native-image-resizer
 */
export const compressImage = async (
  uri: string,
  quality: number = 0.8
): Promise<string> => {
  // TODO: Implement actual image compression
  // For now, return the original URI
  return uri;
};

/**
 * Resize image to target dimensions
 * This is a placeholder - actual implementation would use native modules
 */
export const resizeImage = async (
  uri: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> => {
  // TODO: Implement actual image resizing
  // For now, return the original URI
  return uri;
};
