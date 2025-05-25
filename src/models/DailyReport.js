const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  weight: {
    value: {
      type: Number,
      min: 0,
      max: 500 // Reasonable maximum weight in kg
    },
    unit: {
      type: String,
      enum: ['kg', 'lbs'],
      default: 'kg'
    },
    source: {
      type: String,
      enum: ['manual', 'garmin', 'screenshot'],
      default: 'manual'
    },
    bmi: Number,
    bodyFat: Number, // percentage
    muscleMass: Number, // kg
    waterPercentage: Number // percentage
  },
  activity: {
    steps: {
      count: Number,
      source: {
        type: String,
        enum: ['manual', 'garmin', 'screenshot'],
        default: 'manual'
      }
    },
    distance: Number, // km
    caloriesBurned: Number,
    activeMinutes: Number,
    floorsClimbed: Number,
    heartRateAvg: Number // bpm
  },
  nutrition: {
    calories: {
      value: Number,
      source: {
        type: String,
        enum: ['manual', 'fatsecret', 'ocr', 'screenshot'],
        default: 'manual'
      }
    },
    protein: Number, // in grams
    carbs: Number,   // in grams
    fat: Number,     // in grams
    fiber: Number,   // in grams
    sugar: Number,   // in grams
    sodium: Number,  // in mg
    water: Number,   // in ml
    meals: [{
      name: String,
      brand: String,
      serving: String,
      quantity: Number,
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      fiber: Number,
      sugar: Number,
      sodium: Number
    }],
    notes: String
  },
  training: {
    type: {
      type: String,
      enum: ['strength', 'cardio', 'flexibility', 'other']
    },
    duration: Number, // in minutes
    intensity: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    source: {
      type: String,
      enum: ['manual', 'garmin', 'screenshot'],
      default: 'manual'
    },
    description: String
  },
  mood: {
    rating: {
      type: Number,
      min: 1,
      max: 10
    },
    description: String
  },
  sleep: {
    duration: Number, // in hours
    quality: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent']
    },
    source: {
      type: String,
      enum: ['manual', 'garmin', 'screenshot'],
      default: 'manual'
    },
    deepSleep: Number, // hours
    lightSleep: Number, // hours
    remSleep: Number, // hours
    awakeTime: Number, // hours
    sleepScore: Number,
    bedtime: String,
    wakeTime: String
  },
  comments: String,
  aiFeedback: {
    analysis: String,
    suggestions: [String],
    timestamp: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt timestamp on save
dailyReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Compound index to ensure one report per user per day
dailyReportSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema); 