const FatSecretClient = require('./client');
const logger = require('../../utils/logger');

class FatSecretAnalyzer {
  constructor(consumerKey, consumerSecret) {
    this.client = new FatSecretClient(consumerKey, consumerSecret);
  }

  // Create or get FatSecret profile for a user
  async ensureUserProfile(userId) {
    try {
      // First check if user already has FatSecret tokens in database
      const User = require('../../models/User');
      const user = await User.findOne({ telegramId: userId });
      
      if (user && user.fatsecret && user.fatsecret.authToken && user.fatsecret.authSecret) {
        logger.info(`[FATSECRET] Found existing profile for user: ${userId}`);
        return {
          success: true,
          data: {
            authToken: user.fatsecret.authToken,
            authSecret: user.fatsecret.authSecret
          }
        };
      }
      
      // Create new profile
      logger.info(`[FATSECRET] Creating new profile for user: ${userId}`);
      const profileResult = await this.client.createProfile(userId);
      
      if (profileResult.success) {
        // Store the tokens in database
        if (user) {
          user.fatsecret = {
            authToken: profileResult.data.authToken,
            authSecret: profileResult.data.authSecret,
            profileId: userId,
            lastSync: new Date()
          };
          await user.save();
          logger.info(`[FATSECRET] Stored FatSecret tokens for user: ${userId}`);
        }
        
        return profileResult;
      } else {
        return profileResult;
      }
    } catch (error) {
      logger.error('[FATSECRET] Ensure user profile failed:', error.message);
      return {
        success: false,
        error: 'Не вдалося створити або отримати профіль FatSecret'
      };
    }
  }

  // Get nutrition data from FatSecret diary for a specific date
  async getNutritionFromDiary(userId, date = new Date()) {
    try {
      logger.info(`[FATSECRET] Getting nutrition from diary for user ${userId}, date: ${date.toISOString()}`);
      
      // Ensure user has a FatSecret profile
      const profileResult = await this.ensureUserProfile(userId);
      if (!profileResult.success) {
        return profileResult;
      }

      const { authToken, authSecret } = profileResult.data;

      // Get food diary entries for the date
      const diaryResult = await this.client.getFoodDiaryEntries(date, authToken, authSecret);
      if (!diaryResult.success) {
        return {
          success: false,
          error: 'Не вдалося отримати дані з щоденника харчування FatSecret'
        };
      }

      if (diaryResult.data.length === 0) {
        return {
          success: false,
          error: 'Немає записів у щоденнику харчування FatSecret на цю дату'
        };
      }

      // Parse the diary entries
      const nutritionData = this.client.parseDiaryEntries(diaryResult.data);

      return {
        success: true,
        data: nutritionData
      };
    } catch (error) {
      logger.error('[FATSECRET] Get nutrition from diary failed:', error.message);
      return {
        success: false,
        error: 'Помилка при отриманні даних з FatSecret'
      };
    }
  }

  // Get nutrition data for a month
  async getNutritionFromDiaryMonth(userId, year, month) {
    try {
      logger.info(`[FATSECRET] Getting nutrition from diary for user ${userId}, month: ${year}-${month}`);
      
      // Ensure user has a FatSecret profile
      const profileResult = await this.ensureUserProfile(userId);
      if (!profileResult.success) {
        return profileResult;
      }

      const { authToken, authSecret } = profileResult.data;

      // Get food diary entries for the month
      const diaryResult = await this.client.getFoodDiaryEntriesForMonth(year, month, authToken, authSecret);
      if (!diaryResult.success) {
        return {
          success: false,
          error: 'Не вдалося отримати дані з щоденника харчування FatSecret за місяць'
        };
      }

      return {
        success: true,
        data: diaryResult.data
      };
    } catch (error) {
      logger.error('[FATSECRET] Get nutrition from diary month failed:', error.message);
      return {
        success: false,
        error: 'Помилка при отриманні місячних даних з FatSecret'
      };
    }
  }

  // Analyze nutrition from screenshot text (extracted by OCR)
  async analyzeNutritionFromScreenshot(ocrText) {
    try {
      logger.info('[FATSECRET] Analyzing nutrition from OCR text:', ocrText);
      
      // Parse nutrition data from the OCR text
      const nutritionData = await this.client.parseNutritionFromText(ocrText);
      
      if (!nutritionData || nutritionData.meals.length === 0) {
        return {
          success: false,
          error: 'Не вдалося розпізнати продукти харчування з тексту'
        };
      }

      return {
        success: true,
        data: nutritionData
      };
    } catch (error) {
      logger.error('[FATSECRET] Screenshot analysis failed:', error.message);
      return {
        success: false,
        error: 'Помилка при аналізі скріншоту'
      };
    }
  }

  // Parse manual food input from user
  async parseManualFoodInput(text) {
    try {
      logger.info('[FATSECRET] Parsing manual food input:', text);
      
      // Parse nutrition data from the user input
      const nutritionData = await this.client.parseNutritionFromText(text);
      
      if (!nutritionData || nutritionData.meals.length === 0) {
        return {
          success: false,
          error: 'Не вдалося знайти продукти харчування. Спробуйте більш конкретний опис (наприклад: "яблуко", "курка грудка", "рис відварений")'
        };
      }

      return {
        success: true,
        data: nutritionData
      };
    } catch (error) {
      logger.error('[FATSECRET] Manual food input parsing failed:', error.message);
      return {
        success: false,
        error: 'Помилка при обробці продуктів харчування'
      };
    }
  }

  // Format nutrition message for Telegram
  formatNutritionMessage(nutritionData, source = 'manual') {
    let message = '';
    
    if (source === 'diary') {
      message += `✅ Дані з FatSecret щоденника:\n\n`;
    } else {
      message += `✅ Харчування розпізнано:\n\n`;
    }
    
    message += `📊 Загальна інформація:\n`;
    message += `🔥 Калорії: ${Math.round(nutritionData.calories)} ккал\n`;
    message += `🥩 Білки: ${Math.round(nutritionData.protein)}г\n`;
    message += `🍞 Вуглеводи: ${Math.round(nutritionData.carbs)}г\n`;
    message += `🧈 Жири: ${Math.round(nutritionData.fat)}г\n`;
    
    if (nutritionData.fiber > 0) {
      message += `🌾 Клітковина: ${Math.round(nutritionData.fiber)}г\n`;
    }
    
    if (nutritionData.sugar > 0) {
      message += `🍯 Цукор: ${Math.round(nutritionData.sugar)}г\n`;
    }
    
    if (nutritionData.sodium > 0) {
      message += `🧂 Натрій: ${Math.round(nutritionData.sodium)}мг\n`;
    }

    if (nutritionData.meals && nutritionData.meals.length > 0) {
      message += `\n🍽️ Продукти:\n`;
      nutritionData.meals.forEach((meal, index) => {
        message += `${index + 1}. ${meal.name}`;
        if (meal.brand) {
          message += ` (${meal.brand})`;
        }
        if (meal.meal) {
          message += ` [${meal.meal}]`;
        }
        message += `\n   📏 ${meal.serving}`;
        if (meal.quantity && meal.quantity > 1) {
          message += ` x${meal.quantity}`;
        }
        message += `\n   🔥 ${Math.round(meal.calories)} ккал\n`;
      });
    }

    return message;
  }

  // Format diary entries by meal type
  formatDiaryByMeals(nutritionData) {
    const mealTypes = {
      'breakfast': '🌅 Сніданок',
      'lunch': '🌞 Обід', 
      'dinner': '🌙 Вечеря',
      'other': '🍽️ Інше'
    };

    const mealGroups = {};
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    // Group meals by type
    nutritionData.meals.forEach(meal => {
      const mealType = meal.meal || 'other';
      if (!mealGroups[mealType]) {
        mealGroups[mealType] = [];
      }
      mealGroups[mealType].push(meal);
      
      totalCalories += meal.calories;
      totalProtein += meal.protein;
      totalCarbs += meal.carbs;
      totalFat += meal.fat;
    });

    let message = `📊 Щоденник харчування з FatSecret:\n\n`;
    message += `🔥 Загалом: ${Math.round(totalCalories)} ккал | `;
    message += `🥩 ${Math.round(totalProtein)}г | `;
    message += `🍞 ${Math.round(totalCarbs)}г | `;
    message += `🧈 ${Math.round(totalFat)}г\n\n`;

    // Display each meal type
    Object.keys(mealGroups).forEach(mealType => {
      const meals = mealGroups[mealType];
      const mealCalories = meals.reduce((sum, meal) => sum + meal.calories, 0);
      
      message += `${mealTypes[mealType] || mealType} (${Math.round(mealCalories)} ккал):\n`;
      meals.forEach(meal => {
        message += `• ${meal.name} - ${Math.round(meal.calories)} ккал\n`;
      });
      message += `\n`;
    });

    return message;
  }

  // Search for foods
  async searchFoods(query) {
    try {
      const results = await this.client.searchFood(query);
      return {
        success: true,
        data: results
      };
    } catch (error) {
      logger.error('[FATSECRET] Food search failed:', error.message);
      return {
        success: false,
        error: 'Помилка при пошуку продуктів'
      };
    }
  }

  // Get food details
  async getFoodDetails(foodId) {
    try {
      const food = await this.client.getFoodDetails(foodId);
      if (!food) {
        return {
          success: false,
          error: 'Продукт не знайдено'
        };
      }

      return {
        success: true,
        data: food
      };
    } catch (error) {
      logger.error('[FATSECRET] Get food details failed:', error.message);
      return {
        success: false,
        error: 'Помилка при отриманні деталей продукту'
      };
    }
  }

  // Get nutrition data for a specific food
  async getNutritionData(foodId, servingId = null) {
    try {
      const nutrition = await this.client.getNutritionData(foodId, servingId);
      if (!nutrition) {
        return {
          success: false,
          error: 'Дані про харчування не знайдено'
        };
      }

      return {
        success: true,
        data: nutrition
      };
    } catch (error) {
      logger.error('[FATSECRET] Get nutrition data failed:', error.message);
      return {
        success: false,
        error: 'Помилка при отриманні даних про харчування'
      };
    }
  }
}

module.exports = FatSecretAnalyzer; 