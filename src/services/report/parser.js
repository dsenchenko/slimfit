const Joi = require('joi');

class ReportParser {
  constructor() {
    // Define validation schemas
    this.weightSchema = Joi.object({
      value: Joi.number().min(20).max(300).required(),
      unit: Joi.string().valid('kg', 'кг', 'lbs', 'фунт').default('kg'),
      source: Joi.string().valid('manual', 'garmin', 'screenshot').default('manual')
    });

    this.stepsSchema = Joi.object({
      count: Joi.number().min(0).max(100000).required(),
      distance: Joi.number().min(0).optional(),
      calories: Joi.number().min(0).optional(),
      source: Joi.string().valid('manual', 'garmin', 'screenshot').default('manual')
    });

    this.sleepSchema = Joi.object({
      duration: Joi.number().min(0).max(24).required(),
      quality: Joi.string().valid('good', 'fair', 'poor', 'чудовий', 'нормальний', 'поганий').default('fair'),
      source: Joi.string().valid('manual', 'garmin', 'screenshot').default('manual')
    });

    this.trainingSchema = Joi.object({
      type: Joi.string().valid(
        'running', 'cycling', 'gym', 'swimming', 'walking', 'other',
        'біг', 'велосипед', 'тренування', 'плавання', 'ходьба', 'інше'
      ).required(),
      duration: Joi.number().min(0).max(480).required(),
      intensity: Joi.string().valid(
        'low', 'medium', 'high',
        'низька', 'середня', 'висока'
      ).default('medium'),
      source: Joi.string().valid('manual', 'garmin', 'screenshot').default('manual')
    });

    this.moodSchema = Joi.object({
      value: Joi.string().valid(
        'excellent', 'good', 'neutral', 'bad', 'terrible',
        'чудово', 'добре', 'нормально', 'погано', 'дуже погано'
      ).required()
    });

    // Keywords mapping for both English and Ukrainian
    this.keywords = {
      weight: ['вага', 'weight'],
      steps: ['кроки', 'steps'],
      sleep: ['сон', 'sleep'],
      calories: ['калорії', 'calories'],
      training: ['тренування', 'training'],
      mood: ['настрій', 'mood'],
      comments: ['коментарі', 'comments']
    };

    // Training type mapping
    this.trainingTypes = {
      'біг': 'running',
      'велосипед': 'cycling',
      'тренування': 'gym',
      'плавання': 'swimming',
      'ходьба': 'walking',
      'інше': 'other',
      'running': 'running',
      'cycling': 'cycling',
      'gym': 'gym',
      'swimming': 'swimming',
      'walking': 'walking',
      'other': 'other'
    };

    // Mood mapping
    this.moodValues = {
      'чудово': 'excellent',
      'добре': 'good',
      'нормально': 'neutral',
      'погано': 'bad',
      'дуже погано': 'terrible',
      'excellent': 'excellent',
      'good': 'good',
      'neutral': 'neutral',
      'bad': 'bad',
      'terrible': 'terrible'
    };
  }

  normalizeKey(key) {
    const lowerKey = key.toLowerCase();
    for (const [normalized, keywords] of Object.entries(this.keywords)) {
      if (keywords.includes(lowerKey)) {
        return normalized;
      }
    }
    return lowerKey;
  }

  parseWeight(text) {
    try {
      // Accept only a number (kg)
      const value = parseFloat(text.replace(',', '.'));
      if (isNaN(value) || value < 20 || value > 300) return null;
      const result = {
        value,
        unit: 'kg',
        source: 'manual'
      };
      const { error } = this.weightSchema.validate(result);
      if (error) return null;
      return result;
    } catch (error) {
      return null;
    }
  }

  parseSteps(text) {
    try {
      const steps = parseInt(text);
      if (isNaN(steps)) return null;

      const result = {
        count: steps,
        source: 'manual'
      };

      const { error } = this.stepsSchema.validate(result);
      if (error) return null;

      return result;
    } catch (error) {
      return null;
    }
  }

  parseSleep(text) {
    try {
      // Match patterns like "7 годин", "7:30", "7.5", etc.
      let hours;
      if (text.includes(':')) {
        const [h, m] = text.split(':').map(Number);
        hours = h + (m / 60);
      } else if (text.includes('годин')) {
        hours = parseFloat(text);
      } else {
        hours = parseFloat(text);
      }

      if (isNaN(hours)) return null;

      const result = {
        duration: hours,
        quality: 'fair',
        source: 'manual'
      };

      const { error } = this.sleepSchema.validate(result);
      if (error) return null;

      return result;
    } catch (error) {
      return null;
    }
  }

  parseTraining(text) {
    try {
      const type = this.trainingTypes[text.toLowerCase()];
      if (!type) return null;

      const result = {
        type,
        duration: 30, // Default duration
        intensity: 'medium',
        source: 'manual'
      };

      const { error } = this.trainingSchema.validate(result);
      if (error) return null;

      return result;
    } catch (error) {
      return null;
    }
  }

  parseMood(text) {
    try {
      const value = this.moodValues[text.toLowerCase()];
      if (!value) return null;

      const result = { value };

      const { error } = this.moodSchema.validate(result);
      if (error) return null;

      return result;
    } catch (error) {
      return null;
    }
  }

  parseReport(text) {
    try {
      const lines = text.split('\n').map(line => line.trim());
      const report = {};

      for (const line of lines) {
        const [key, value] = line.split(':').map(part => part.trim());
        if (!key || !value) continue;

        const normalizedKey = this.normalizeKey(key);
        switch (normalizedKey) {
          case 'weight':
            report.weight = this.parseWeight(value);
            break;
          case 'steps':
            report.steps = this.parseSteps(value);
            break;
          case 'sleep':
            report.sleep = this.parseSleep(value);
            break;
          case 'calories':
            report.calories = parseInt(value);
            break;
          case 'training':
            report.training = this.parseTraining(value);
            break;
          case 'mood':
            report.mood = this.parseMood(value);
            break;
          case 'comments':
            report.comments = value;
            break;
        }
      }

      return report;
    } catch (error) {
      throw new Error('Validation error: ' + error.message);
    }
  }
}

module.exports = ReportParser; 