const { OpenAI } = require('openai');
const logger = require('../../utils/logger');

class OpenAIService {
  constructor(apiKey) {
    if (!apiKey) {
      logger.warn('OpenAI API key not provided. AI features will be disabled.');
      this.openai = null;
      return;
    }
    
    this.openai = new OpenAI({ apiKey });
    this.model = 'gpt-4-vision-preview';
    this.textModel = 'gpt-4-turbo-preview';
  }

  /**
   * Analyze a meal image and extract nutritional information
   * @param {string} base64Image - Base64 encoded image
   * @param {string} mealType - Type of meal (breakfast, lunch, dinner, snack, other)
   * @returns {Object} Analysis results
   */
  async analyzeMealImage(base64Image, mealType = 'other') {
    if (!this.openai) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const prompt = this.buildMealAnalysisPrompt(mealType);

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const analysisText = response.choices[0].message.content;
      return this.parseMealAnalysis(analysisText);

    } catch (error) {
      logger.error('Error analyzing meal image:', error);
      throw new Error('Failed to analyze meal image. Please try again later.');
    }
  }

  /**
   * Build prompt for meal image analysis
   */
  buildMealAnalysisPrompt(mealType) {
    return `Analyze this ${mealType} image and provide detailed nutritional information.

Please identify the food items and provide the following information in JSON format:

{
  "recognized": true,
  "confidence": 85,
  "dishes": [
    {
      "name": "dish name",
      "quantity": "portion size",
      "calories": estimated_calories,
      "protein": grams_of_protein,
      "carbs": grams_of_carbs,
      "fat": grams_of_fat,
      "fiber": grams_of_fiber,
      "sugar": grams_of_sugar,
      "sodium": milligrams_of_sodium
    }
  ],
  "nutrition": {
    "calories": total_calories,
    "protein": total_protein,
    "carbs": total_carbs,
    "fat": total_fat,
    "fiber": total_fiber,
    "sugar": total_sugar,
    "sodium": total_sodium
  },
  "healthiness": 8,
  "suggestions": [
    "Add more vegetables for fiber",
    "Consider reducing portion size"
  ],
  "notes": "Additional observations about the meal"
}

Be as accurate as possible with nutritional estimates. If you're uncertain about exact values, indicate this in the confidence score (0-100).`;
  }

  /**
   * Parse the AI response for meal analysis
   */
  parseMealAnalysis(analysisText) {
    try {
      // Extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate and structure the response
      return {
        recognized: parsed.recognized || false,
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 100),
        dishes: parsed.dishes || [],
        nutrition: {
          calories: parsed.nutrition?.calories || 0,
          protein: parsed.nutrition?.protein || 0,
          carbs: parsed.nutrition?.carbs || 0,
          fat: parsed.nutrition?.fat || 0,
          fiber: parsed.nutrition?.fiber || 0,
          sugar: parsed.nutrition?.sugar || 0,
          sodium: parsed.nutrition?.sodium || 0
        },
        healthiness: Math.min(Math.max(parsed.healthiness || 5, 1), 10),
        suggestions: parsed.suggestions || [],
        notes: parsed.notes || '',
        analyzedAt: new Date()
      };

    } catch (error) {
      logger.error('Error parsing meal analysis:', error);
      // Return fallback structure
      return {
        recognized: false,
        confidence: 0,
        dishes: [],
        nutrition: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0
        },
        healthiness: 5,
        suggestions: ['Unable to analyze image. Please try with a clearer photo.'],
        notes: 'Failed to recognize food items in the image',
        analyzedAt: new Date()
      };
    }
  }

  /**
   * Analyze a complete daily report and provide insights
   * @param {Object} report - Daily report object
   * @param {Object} user - User object
   * @returns {Object} Analysis results
   */
  async analyzeDailyReport(report, user) {
    if (!this.openai) {
      throw new Error('OpenAI service not initialized');
    }

    try {
      const prompt = this.buildDailyReportPrompt(report, user);

      const response = await this.openai.chat.completions.create({
        model: this.textModel,
        messages: [
          {
            role: 'system',
            content: 'You are a professional health and wellness coach. Analyze daily health reports and provide personalized insights and recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      const analysisText = response.choices[0].message.content;
      return this.parseDailyReportAnalysis(analysisText);

    } catch (error) {
      logger.error('Error analyzing daily report:', error);
      throw new Error('Failed to analyze daily report. Please try again later.');
    }
  }

  /**
   * Build prompt for daily report analysis
   */
  buildDailyReportPrompt(report, user) {
    const userInfo = `
User Profile:
- Age: ${user.age || 'Unknown'}
- Gender: ${user.gender || 'Unknown'}
- Height: ${user.height?.value || 'Unknown'} ${user.height?.unit || ''}
- Activity Level: ${user.activityLevel || 'Unknown'}
- Goals: ${user.goals?.weightGoal || 'Unknown'}
- Target Weight: ${user.goals?.targetWeight || 'Unknown'} kg
`;

    const reportData = `
Daily Report Data:
- Date: ${report.date.toISOString().split('T')[0]}
- Weight: ${report.weight?.value || 'Not recorded'} ${report.weight?.unit || ''}
- Sleep: ${report.sleep?.duration ? `${Math.round(report.sleep.duration / 60)} hours` : 'Not recorded'}
- Steps: ${report.steps?.count || 'Not recorded'}
- Total Calories: ${report.totalNutrition?.calories || 0}
- Protein: ${report.totalNutrition?.protein || 0}g
- Carbs: ${report.totalNutrition?.carbs || 0}g
- Fat: ${report.totalNutrition?.fat || 0}g
- Meals: ${report.meals.length} meals logged
- Mood: ${report.mood?.rating || 'Not recorded'}/10
- Exercise: ${report.exercise?.type || 'None'} ${report.exercise?.duration ? `(${report.exercise.duration} min)` : ''}
- Water: ${report.water?.amount || 0} ${report.water?.unit || 'ml'}
- Comments: ${report.comments || 'None'}
`;

    return `${userInfo}

${reportData}

Please analyze this daily health report and provide:

1. **Summary**: Brief overview of the day's health metrics
2. **Recommendations**: 3-5 specific, actionable recommendations for improvement
3. **Health Score**: Overall health score (0-100) based on the data
4. **Goals**: 2-3 specific goals for tomorrow
5. **Warnings**: Any health concerns or areas that need attention

Format your response as a structured analysis that's easy to read and actionable.`;
  }

  /**
   * Parse daily report analysis
   */
  parseDailyReportAnalysis(analysisText) {
    try {
      // For now, return the full text as summary
      // In the future, we could parse structured sections
      return {
        summary: analysisText,
        recommendations: this.extractRecommendations(analysisText),
        healthScore: this.extractHealthScore(analysisText),
        goals: this.extractGoals(analysisText),
        warnings: this.extractWarnings(analysisText),
        analyzedAt: new Date()
      };
    } catch (error) {
      logger.error('Error parsing daily report analysis:', error);
      return {
        summary: 'Analysis completed successfully.',
        recommendations: ['Continue tracking your daily metrics', 'Stay hydrated', 'Get adequate sleep'],
        healthScore: 75,
        goals: ['Maintain current habits', 'Focus on consistency'],
        warnings: [],
        analyzedAt: new Date()
      };
    }
  }

  /**
   * Extract recommendations from analysis text
   */
  extractRecommendations(text) {
    const recommendations = [];
    const lines = text.split('\n');
    
    let inRecommendations = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('recommendation')) {
        inRecommendations = true;
        continue;
      }
      if (inRecommendations && line.trim().startsWith('-')) {
        recommendations.push(line.trim().substring(1).trim());
      }
      if (inRecommendations && line.toLowerCase().includes('health score')) {
        break;
      }
    }
    
    return recommendations.length > 0 ? recommendations : ['Continue your current healthy habits'];
  }

  /**
   * Extract health score from analysis text
   */
  extractHealthScore(text) {
    const scoreMatch = text.match(/health score[:\s]*(\d+)/i);
    if (scoreMatch) {
      return parseInt(scoreMatch[1]);
    }
    return 75; // Default score
  }

  /**
   * Extract goals from analysis text
   */
  extractGoals(text) {
    const goals = [];
    const lines = text.split('\n');
    
    let inGoals = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('goal')) {
        inGoals = true;
        continue;
      }
      if (inGoals && line.trim().startsWith('-')) {
        goals.push(line.trim().substring(1).trim());
      }
      if (inGoals && line.toLowerCase().includes('warning')) {
        break;
      }
    }
    
    return goals.length > 0 ? goals : ['Focus on consistency', 'Stay hydrated'];
  }

  /**
   * Extract warnings from analysis text
   */
  extractWarnings(text) {
    const warnings = [];
    const lines = text.split('\n');
    
    let inWarnings = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('warning')) {
        inWarnings = true;
        continue;
      }
      if (inWarnings && line.trim().startsWith('-')) {
        warnings.push(line.trim().substring(1).trim());
      }
    }
    
    return warnings;
  }
}

module.exports = OpenAIService; 