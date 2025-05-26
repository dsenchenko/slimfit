const axios = require('axios');
const logger = require('./logger');

class ImageProcessor {
  /**
   * Download image from Telegram and convert to base64
   * @param {string} fileId - Telegram file ID
   * @param {string} botToken - Telegram bot token
   * @returns {Object} Image data with base64
   */
  static async downloadTelegramImage(fileId, botToken) {
    try {
      // Get file info from Telegram
      const fileInfoResponse = await axios.get(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );

      if (!fileInfoResponse.data.ok) {
        throw new Error('Failed to get file info from Telegram');
      }

      const filePath = fileInfoResponse.data.result.file_path;
      const fileSize = fileInfoResponse.data.result.file_size;

      // Download the actual file
      const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
      const imageResponse = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 seconds timeout
      });

      // Convert to base64
      const base64 = Buffer.from(imageResponse.data).toString('base64');

      // Determine MIME type from file extension
      const mimeType = this.getMimeTypeFromPath(filePath);

      return {
        base64,
        mimeType,
        size: fileSize,
        originalName: filePath.split('/').pop(),
        filename: `telegram_${fileId}_${Date.now()}`
      };
    } catch (error) {
      logger.error('Error downloading Telegram image:', error);
      throw new Error(`Помилка завантаження зображення: ${error.message}`);
    }
  }

  /**
   * Process multiple Telegram photos
   * @param {Array} photos - Array of Telegram photo objects
   * @param {string} botToken - Telegram bot token
   * @param {Array} mealTypes - Array of meal types corresponding to photos
   * @returns {Array} Processed image objects
   */
  static async processTelegramPhotos(photos, botToken, mealTypes = []) {
    const processedImages = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const mealType = mealTypes[i] || 'other';

      try {
        // Get the highest quality photo
        const bestPhoto = this.getBestQualityPhoto(photo);
        
        // Download and process
        const imageData = await this.downloadTelegramImage(bestPhoto.file_id, botToken);
        
        processedImages.push({
          ...imageData,
          mealType,
          source: 'telegram',
          timestamp: new Date()
        });

        logger.info(`Processed image ${i + 1}/${photos.length} for meal type: ${mealType}`);
      } catch (error) {
        logger.error(`Error processing image ${i + 1}:`, error);
        // Continue with other images
      }
    }

    return processedImages;
  }

  /**
   * Get the best quality photo from Telegram photo array
   * @param {Array} photoSizes - Array of photo sizes from Telegram
   * @returns {Object} Best quality photo object
   */
  static getBestQualityPhoto(photoSizes) {
    if (!Array.isArray(photoSizes) || photoSizes.length === 0) {
      throw new Error('No photo sizes available');
    }

    // Sort by file size (larger = better quality)
    return photoSizes.reduce((best, current) => {
      return (current.file_size || 0) > (best.file_size || 0) ? current : best;
    });
  }

  /**
   * Get MIME type from file path
   * @param {string} filePath - File path
   * @returns {string} MIME type
   */
  static getMimeTypeFromPath(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp'
    };

    return mimeTypes[extension] || 'image/jpeg';
  }

  /**
   * Validate image format and size
   * @param {Object} imageData - Image data object
   * @param {Object} options - Validation options
   * @returns {boolean} Is valid
   */
  static validateImage(imageData, options = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    } = options;

    // Check file size
    if (imageData.size > maxSize) {
      throw new Error(`Розмір файлу перевищує максимально дозволений (${Math.round(maxSize / 1024 / 1024)}MB)`);
    }

    // Check MIME type
    if (!allowedTypes.includes(imageData.mimeType)) {
      throw new Error(`Непідтримуваний формат файлу. Дозволені: ${allowedTypes.join(', ')}`);
    }

    // Check base64 data
    if (!imageData.base64 || imageData.base64.length === 0) {
      throw new Error('Відсутні дані зображення');
    }

    return true;
  }

  /**
   * Resize base64 image if needed (placeholder for future implementation)
   * @param {string} base64 - Base64 image data
   * @param {Object} options - Resize options
   * @returns {string} Resized base64 image
   */
  static async resizeImage(base64, options = {}) {
    // For now, return as-is
    // In the future, we could implement image resizing using sharp or similar library
    return base64;
  }

  /**
   * Extract metadata from image (placeholder for future implementation)
   * @param {string} base64 - Base64 image data
   * @returns {Object} Image metadata
   */
  static extractMetadata(base64) {
    // For now, return basic info
    // In the future, we could extract EXIF data, dimensions, etc.
    return {
      extractedAt: new Date(),
      format: 'unknown',
      dimensions: null
    };
  }

  /**
   * Create thumbnail from base64 image (placeholder for future implementation)
   * @param {string} base64 - Base64 image data
   * @param {Object} options - Thumbnail options
   * @returns {string} Thumbnail base64
   */
  static async createThumbnail(base64, options = {}) {
    // For now, return original
    // In the future, implement thumbnail generation
    return base64;
  }
}

module.exports = ImageProcessor; 