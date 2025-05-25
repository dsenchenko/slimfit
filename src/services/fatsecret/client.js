const OAuth = require('oauth-1.0a');
const crypto = require('crypto-js');
const axios = require('axios');
const logger = require('../../utils/logger');

class FatSecretClient {
  constructor(consumerKey, consumerSecret) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.baseUrl = 'https://platform.fatsecret.com/rest/server.api';
    
    // Initialize OAuth 1.0a with explicit configuration
    this.oauth = OAuth({
      consumer: {
        key: this.consumerKey,
        secret: this.consumerSecret
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
      },
      realm: '',
      version: '1.0'
    });
    
    logger.info(`[FATSECRET] Client initialized with consumer key: ${this.consumerKey.substring(0, 8)}...`);
  }

  // Make signed request (for public API methods)
  async makeRequest(method, params = {}) {
    try {
      logger.info(`[FATSECRET] Making request: ${method}`, params);
      
      // Prepare the request parameters
      const requestParams = {
        method: method,
        format: 'json',
        ...params
      };
      
      // Add OAuth parameters to the request
      const oauthParams = {
        oauth_consumer_key: this.consumerKey,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_nonce: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        oauth_version: '1.0'
      };
      
      // Combine all parameters for signature generation
      const allParams = { ...requestParams, ...oauthParams };
      
      const requestData = {
        url: this.baseUrl,
        method: 'POST',
        data: allParams
      };

      // Generate OAuth authorization
      const authorization = this.oauth.authorize(requestData);
      
      // Add the signature to the parameters
      const finalParams = {
        ...allParams,
        oauth_signature: authorization.oauth_signature
      };
      
      logger.info(`[FATSECRET] Request URL: ${this.baseUrl}`);
      logger.info(`[FATSECRET] Final params:`, finalParams);
      
      const response = await axios({
        method: 'POST',
        url: this.baseUrl,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams(finalParams).toString(),
        responseType: 'text'
      });

      logger.info(`[FATSECRET] Response status: ${response.status}`);
      logger.info(`[FATSECRET] Raw response:`, response.data);
      
      // Parse the JSON response - handle character-indexed response format
      let responseData;
      try {
        if (typeof response.data === 'object' && response.data['0']) {
          // Reconstruct string from character-indexed object
          let jsonString = '';
          for (let i = 0; i < 1000; i++) {
            if (response.data[i.toString()]) {
              jsonString += response.data[i.toString()];
            } else {
              break;
            }
          }
          responseData = JSON.parse(jsonString);
        } else {
          responseData = JSON.parse(response.data);
        }
      } catch (parseError) {
        logger.error('[FATSECRET] Failed to parse response as JSON:', response.data);
        throw new Error('Invalid JSON response from FatSecret API');
      }
      
      logger.info(`[FATSECRET] Parsed response data:`, JSON.stringify(responseData, null, 2));

      return responseData;
    } catch (error) {
      logger.error('[FATSECRET] API request failed:', error.message);
      if (error.response) {
        logger.error('[FATSECRET] Response status:', error.response.status);
        logger.error('[FATSECRET] Response data:', error.response.data);
      }
      throw error;
    }
  }

  // Make authenticated request (for user-specific API methods)
  async makeAuthenticatedRequest(method, params = {}, userToken, userSecret) {
    try {
      const requestData = {
        url: this.baseUrl,
        method: 'POST',
        data: {
          method: method,
          format: 'json',
          ...params
        }
      };

      // Create OAuth with user tokens
      const userOauth = OAuth({
        consumer: {
          key: this.consumerKey,
          secret: this.consumerSecret
        },
        signature_method: 'HMAC-SHA1',
        hash_function(base_string, key) {
          return crypto.HmacSHA1(base_string, key).toString(crypto.enc.Base64);
        }
      });

      const token = {
        key: userToken,
        secret: userSecret
      };

      const authHeader = userOauth.toHeader(userOauth.authorize(requestData, token));
      
      const response = await axios({
        method: 'POST',
        url: this.baseUrl,
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams({
          method: method,
          format: 'json',
          ...params
        }).toString()
      });

      return response.data;
    } catch (error) {
      logger.error('[FATSECRET] Authenticated API request failed:', error.message);
      throw error;
    }
  }

  // Create a FatSecret profile for a user
  async createProfile(userId) {
    try {
      logger.info(`[FATSECRET] Creating profile for user: ${userId}`);
      
      const response = await this.makeRequest('profile.create', {
        user_id: userId
      });
      
      logger.info(`[FATSECRET] Create profile response:`, JSON.stringify(response, null, 2));
      
      if (response && response.profile) {
        return {
          success: true,
          data: {
            authToken: response.profile.auth_token,
            authSecret: response.profile.auth_secret
          }
        };
      } else {
        logger.error('[FATSECRET] Invalid response structure:', response);
        return {
          success: false,
          error: 'Invalid response from FatSecret API'
        };
      }
    } catch (error) {
      logger.error('[FATSECRET] Create profile failed:', error.message);
      if (error.response) {
        logger.error('[FATSECRET] Response status:', error.response.status);
        logger.error('[FATSECRET] Response data:', JSON.stringify(error.response.data, null, 2));
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get authentication tokens for an existing profile
  async getProfileAuth(userId) {
    try {
      logger.info(`[FATSECRET] Getting profile auth for user: ${userId}`);
      
      // FatSecret doesn't have a separate "get auth" method
      // We try to create a profile, and if it already exists, we'll get an error
      // In a real implementation, you would store the tokens when creating the profile
      // and retrieve them from your database
      
      logger.info(`[FATSECRET] Profile auth tokens should be retrieved from database for user: ${userId}`);
      
      return {
        success: false,
        error: 'Profile auth tokens should be stored and retrieved from your database. Use createProfile to get new tokens.'
      };
    } catch (error) {
      logger.error('[FATSECRET] Get profile auth failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get food diary entries for a specific date
  async getFoodDiaryEntries(date, userToken, userSecret) {
    try {
      // Convert date to FatSecret format (days since Jan 1, 1970)
      const dateInt = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
      
      const response = await this.makeAuthenticatedRequest(
        'food_entries.get.v2',
        { date: dateInt },
        userToken,
        userSecret
      );

      // Handle both single entry and multiple entries
      let entries = [];
      if (response.food_entries && response.food_entries.food_entry) {
        entries = Array.isArray(response.food_entries.food_entry) 
          ? response.food_entries.food_entry 
          : [response.food_entries.food_entry];
      }

      return {
        success: true,
        data: entries
      };
    } catch (error) {
      logger.error('[FATSECRET] Get food diary entries failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get food diary entries for a month
  async getFoodDiaryEntriesForMonth(year, month, userToken, userSecret) {
    try {
      const response = await this.makeAuthenticatedRequest(
        'food_entries.get_month.v2',
        { 
          date: `${year}-${month.toString().padStart(2, '0')}-01`
        },
        userToken,
        userSecret
      );

      return {
        success: true,
        data: response.food_entries || []
      };
    } catch (error) {
      logger.error('[FATSECRET] Get food diary entries for month failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Parse nutrition data from FatSecret diary entries
  parseDiaryEntries(entries) {
    const nutritionData = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      meals: []
    };

    for (const entry of entries) {
      const calories = parseFloat(entry.calories || 0);
      const protein = parseFloat(entry.protein || 0);
      const carbs = parseFloat(entry.carbohydrate || 0);
      const fat = parseFloat(entry.fat || 0);
      const fiber = parseFloat(entry.fiber || 0);
      const sugar = parseFloat(entry.sugar || 0);
      const sodium = parseFloat(entry.sodium || 0);

      nutritionData.calories += calories;
      nutritionData.protein += protein;
      nutritionData.carbs += carbs;
      nutritionData.fat += fat;
      nutritionData.fiber += fiber;
      nutritionData.sugar += sugar;
      nutritionData.sodium += sodium;

      nutritionData.meals.push({
        name: entry.food_entry_name,
        description: entry.food_entry_description,
        meal: entry.meal,
        serving: `${entry.number_of_units} units`,
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        fiber: fiber,
        sugar: sugar,
        sodium: sodium,
        foodId: entry.food_id,
        servingId: entry.serving_id,
        entryId: entry.food_entry_id
      });
    }

    return nutritionData;
  }

  // Search for foods (public API)
  async searchFood(query) {
    try {
      const response = await this.makeRequest('foods.search', {
        search_expression: query,
        max_results: 10
      });
      
      return response.foods?.food || [];
    } catch (error) {
      logger.error('[FATSECRET] Food search failed:', error.message);
      return [];
    }
  }

  // Get food details (public API)
  async getFoodDetails(foodId) {
    try {
      const response = await this.makeRequest('food.get', {
        food_id: foodId
      });
      
      return response.food;
    } catch (error) {
      logger.error('[FATSECRET] Get food details failed:', error.message);
      return null;
    }
  }

  // Legacy method for backward compatibility
  async parseNutritionFromText(text) {
    try {
      // Simple text parsing for food items
      const foodItems = this.extractFoodItems(text);
      const nutritionData = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        meals: []
      };

      for (const item of foodItems) {
        const searchResults = await this.searchFood(item.name);
        if (searchResults.length > 0) {
          const food = searchResults[0];
          const serving = food.servings?.serving?.[0] || food.servings?.serving;
          
          if (serving) {
            const quantity = item.quantity || 1;
            const calories = parseFloat(serving.calories || 0) * quantity;
            const protein = parseFloat(serving.protein || 0) * quantity;
            const carbs = parseFloat(serving.carbohydrate || 0) * quantity;
            const fat = parseFloat(serving.fat || 0) * quantity;
            const fiber = parseFloat(serving.fiber || 0) * quantity;
            const sugar = parseFloat(serving.sugar || 0) * quantity;
            const sodium = parseFloat(serving.sodium || 0) * quantity;

            nutritionData.calories += calories;
            nutritionData.protein += protein;
            nutritionData.carbs += carbs;
            nutritionData.fat += fat;
            nutritionData.fiber += fiber;
            nutritionData.sugar += sugar;
            nutritionData.sodium += sodium;

            nutritionData.meals.push({
              name: food.food_name,
              brand: food.brand_name || '',
              serving: serving.serving_description,
              quantity: quantity,
              calories: calories,
              protein: protein,
              carbs: carbs,
              fat: fat,
              fiber: fiber,
              sugar: sugar,
              sodium: sodium
            });
          }
        }
      }

      return nutritionData;
    } catch (error) {
      logger.error('[FATSECRET] Parse nutrition from text failed:', error.message);
      throw error;
    }
  }

  extractFoodItems(text) {
    // Basic food item extraction from text
    const items = [];
    const lines = text.split(/[,\n]/);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 2) {
        // Try to extract quantity and food name
        const quantityMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.+)/);
        if (quantityMatch) {
          items.push({
            quantity: parseFloat(quantityMatch[1]),
            name: quantityMatch[2].trim()
          });
        } else {
          items.push({
            quantity: 1,
            name: trimmed
          });
        }
      }
    }
    
    return items;
  }

  // Get nutrition data for a specific food and serving
  async getNutritionData(foodId, servingId = null) {
    try {
      const food = await this.getFoodDetails(foodId);
      if (!food) return null;

      // If no specific serving ID provided, use the first serving
      const servings = food.servings?.serving;
      if (!servings) return null;

      const serving = servingId 
        ? (Array.isArray(servings) ? servings.find(s => s.serving_id === servingId) : servings)
        : (Array.isArray(servings) ? servings[0] : servings);

      if (!serving) return null;

      return {
        food_name: food.food_name,
        brand_name: food.brand_name || null,
        serving_description: serving.serving_description,
        serving_id: serving.serving_id,
        calories: parseFloat(serving.calories) || 0,
        protein: parseFloat(serving.protein) || 0,
        carbohydrate: parseFloat(serving.carbohydrate) || 0,
        fat: parseFloat(serving.fat) || 0,
        fiber: parseFloat(serving.fiber) || 0,
        sugar: parseFloat(serving.sugar) || 0,
        sodium: parseFloat(serving.sodium) || 0,
        saturated_fat: parseFloat(serving.saturated_fat) || 0,
        cholesterol: parseFloat(serving.cholesterol) || 0
      };
    } catch (error) {
      logger.error('Error getting nutrition data:', error);
      return null;
    }
  }

  // Get popular foods for suggestions
  async getPopularFoods() {
    try {
      // FatSecret doesn't have a direct "popular foods" endpoint, 
      // so we'll search for common food categories
      const categories = ['chicken', 'rice', 'bread', 'apple', 'milk', 'egg'];
      const popularFoods = [];

      for (const category of categories) {
        const results = await this.searchFood(category);
        popularFoods.push(...results);
      }

      return popularFoods.slice(0, 20); // Return top 20
    } catch (error) {
      logger.error('Error getting popular foods:', error);
      return [];
    }
  }

  // Analyze meal photo using OCR (placeholder for future implementation)
  async analyzeMealPhoto(imageBase64) {
    // This would integrate with OCR service to extract text from meal photos
    // For now, return a placeholder
    logger.info('Meal photo analysis not yet implemented');
    return {
      success: false,
      message: 'Meal photo analysis is not yet implemented'
    };
  }
}

module.exports = FatSecretClient; 