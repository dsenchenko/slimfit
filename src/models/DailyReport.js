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
      enum: ['manual', 'garmin'],
      default: 'manual'
    }
  },
  nutrition: {
    calories: {
      value: Number,
      source: {
        type: String,
        enum: ['manual', 'fatsecret', 'ocr'],
        default: 'manual'
      }
    },
    protein: Number, // in grams
    carbs: Number,   // in grams
    fat: Number,     // in grams
    water: Number,   // in ml
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
      enum: ['manual', 'garmin'],
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
    duration: Number, // in minutes
    quality: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent']
    },
    source: {
      type: String,
      enum: ['manual', 'garmin'],
      default: 'manual'
    }
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