const { OpenAI } = require('openai');
const logger = require('../../utils/logger');

class OpenAIAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.model = 'gpt-4-turbo-preview';
  }

  async analyzeReport(report, user, history) {
    try {
      if (!Array.isArray(history)) history = [];
      const prompt = this.buildPrompt(report, user, history);
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `Ти - експерт з здорового способу життя та фітнесу. Твоя задача - аналізувати щоденні звіти користувачів та надавати корисні поради українською мовою.
            
            Твої відповіді повинні бути:
            1. Професійними та інформативними
            2. Підтримуючими та мотивуючими
            3. Зосередженими на практичних рекомендаціях
            4. Написаними українською мовою
            
            Структуруй свою відповідь наступним чином:
            
            📊 АНАЛІЗ:
            - Короткий аналіз поточного стану
            - Порівняння з попередніми показниками
            - Визначення трендів та патернів
            
            💡 РЕКОМЕНДАЦІЇ:
            - Конкретні поради щодо харчування
            - Рекомендації щодо тренувань
            - Поради щодо сну та відпочинку
            - Загальні рекомендації щодо здорового способу життя
            
            🎯 ЦІЛІ:
            - Короткострокові цілі на наступні дні
            - Довгострокові цілі на тиждень
            
            Використову емодзі для покращення читабельності, але не перестарайся.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const analysis = response.choices[0].message.content;
      return this.parseAnalysis(analysis);
    } catch (error) {
      logger.error('Помилка аналізу звіту:', error);
      throw new Error('Не вдалося проаналізувати звіт. Будь ласка, спробуйте пізніше.');
    }
  }

  buildPrompt(report, user, history) {
    const currentReport = this.formatReport(report);
    const historyFormatted = this.formatHistory(history);

    return `Поточний звіт:
${currentReport}

${historyFormatted ? `Історія попередніх звітів:
${historyFormatted}` : ''}

Будь ласка, проаналізуй цей звіт та надай детальні рекомендації українською мовою.`;
  }

  formatReport(report) {
    const parts = [];

    if (report.weight) {
      parts.push(`Вага: ${report.weight.value} ${report.weight.unit}`);
    }

    if (report.nutrition) {
      const nutrition = report.nutrition;
      const nutritionParts = [];
      
      if (nutrition.calories) {
        nutritionParts.push(`Калорії: ${nutrition.calories.value}`);
      }
      if (nutrition.protein) nutritionParts.push(`Білки: ${nutrition.protein}г`);
      if (nutrition.carbs) nutritionParts.push(`Вуглеводи: ${nutrition.carbs}г`);
      if (nutrition.fat) nutritionParts.push(`Жири: ${nutrition.fat}г`);
      if (nutrition.water) nutritionParts.push(`Вода: ${nutrition.water}мл`);
      
      if (nutritionParts.length > 0) {
        parts.push(`Харчування:\n${nutritionParts.join('\n')}`);
      }
      if (nutrition.notes) parts.push(`Примітки щодо харчування: ${nutrition.notes}`);
    }

    if (report.training) {
      const training = report.training;
      const trainingParts = [
        `Тип: ${this.getTrainingTypeInUkrainian(training.type)}`,
        `Тривалість: ${training.duration} хв`,
        `Інтенсивність: ${this.getIntensityInUkrainian(training.intensity)}`
      ];
      if (training.description) trainingParts.push(`Опис: ${training.description}`);
      parts.push(`Тренування:\n${trainingParts.join('\n')}`);
    }

    if (report.mood) {
      parts.push(`Настрій: ${report.mood.rating}/10 (${report.mood.description})`);
    }

    if (report.sleep) {
      const sleep = report.sleep;
      parts.push(`Сон: ${Math.floor(sleep.duration / 60)}г ${sleep.duration % 60}хв (${this.getSleepQualityInUkrainian(sleep.quality)})`);
    }

    if (report.comments) {
      parts.push(`Коментарі: ${report.comments}`);
    }

    return parts.join('\n\n');
  }

  formatHistory(history) {
    if (!Array.isArray(history)) history = [];
    return history.map((report, index) => {
      const date = new Date(report.date).toLocaleDateString('uk-UA');
      return `Звіт за ${date}:\n${this.formatReport(report)}`;
    }).join('\n\n');
  }

  parseAnalysis(analysis) {
    const sections = {
      analysis: '',
      recommendations: '',
      goals: ''
    };

    const lines = analysis.split('\n');
    let currentSection = null;

    for (const line of lines) {
      if (line.includes('АНАЛІЗ:')) {
        currentSection = 'analysis';
        continue;
      } else if (line.includes('РЕКОМЕНДАЦІЇ:')) {
        currentSection = 'recommendations';
        continue;
      } else if (line.includes('ЦІЛІ:')) {
        currentSection = 'goals';
        continue;
      }

      if (currentSection && line.trim()) {
        sections[currentSection] += line + '\n';
      }
    }

    return {
      analysis: sections.analysis.trim(),
      recommendations: sections.recommendations.trim(),
      goals: sections.goals.trim()
    };
  }

  getTrainingTypeInUkrainian(type) {
    const types = {
      'strength': 'Силове',
      'cardio': 'Кардіо',
      'flexibility': 'Гнучкість',
      'other': 'Інше'
    };
    return types[type] || type;
  }

  getIntensityInUkrainian(intensity) {
    const intensities = {
      'low': 'Низька',
      'medium': 'Середня',
      'high': 'Висока'
    };
    return intensities[intensity] || intensity;
  }

  getSleepQualityInUkrainian(quality) {
    const qualities = {
      'poor': 'Погана',
      'fair': 'Задовільна',
      'good': 'Хороша',
      'excellent': 'Відмінна'
    };
    return qualities[quality] || quality;
  }
}

module.exports = OpenAIAnalyzer; 