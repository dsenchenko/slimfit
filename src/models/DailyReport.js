const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'],
    required: true
  },
  description: String,
  calories: {
    type: Number,
    min: 0
  },
  protein: {
    type: Number,
    min: 0
  },
  carbs: {
    type: Number,
    min: 0
  },
  fat: {
    type: Number,
    min: 0
  },
  fiber: {
    type: Number,
    min: 0
  },
  sugar: {
    type: Number,
    min: 0
  },
  sodium: {
    type: Number,
    min: 0
  },
  image: {
    data: String, // base64 encoded image
    mimeType: String,
    filename: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  aiAnalysis: {
    recognized: Boolean,
    confidence: Number,
    suggestions: [String],
    analyzedAt: Date
  },
  source: {
    type: String,
    enum: ['manual', 'image', 'fatsecret'],
    default: 'manual'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

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
      enum: ['manual', 'image'],
      default: 'manual'
    },
    image: {
      data: String, // base64 encoded image
      mimeType: String,
      filename: String,
      uploadedAt: Date
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  sleep: {
    duration: {
      type: Number, // in minutes
      min: 0,
      max: 1440 // 24 hours max
    },
    quality: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent']
    },
    bedtime: Date,
    wakeupTime: Date,
    source: {
      type: String,
      enum: ['manual', 'image'],
      default: 'manual'
    },
    image: {
      data: String, // base64 encoded image
      mimeType: String,
      filename: String,
      uploadedAt: Date
    },
    notes: String
  },
  steps: {
    count: {
      type: Number,
      min: 0,
      max: 100000 // Reasonable maximum
    },
    distance: {
      value: Number, // in km
      unit: {
        type: String,
        enum: ['km', 'miles'],
        default: 'km'
      }
    },
    activeMinutes: Number,
    caloriesBurned: Number,
    source: {
      type: String,
      enum: ['manual', 'image'],
      default: 'manual'
    },
    image: {
      data: String, // base64 encoded image
      mimeType: String,
      filename: String,
      uploadedAt: Date
    }
  },
  meals: [mealSchema],
  totalNutrition: {
    calories: {
      type: Number,
      min: 0,
      default: 0
    },
    protein: {
      type: Number,
      min: 0,
      default: 0
    },
    carbs: {
      type: Number,
      min: 0,
      default: 0
    },
    fat: {
      type: Number,
      min: 0,
      default: 0
    },
    fiber: {
      type: Number,
      min: 0,
      default: 0
    },
    sugar: {
      type: Number,
      min: 0,
      default: 0
    },
    sodium: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  mood: {
    rating: {
      type: Number,
      min: 1,
      max: 10
    },
    notes: String,
    energy: {
      type: Number,
      min: 1,
      max: 10
    },
    stress: {
      type: Number,
      min: 1,
      max: 10
    }
  },
  exercise: {
    type: String,
    duration: Number, // in minutes
    intensity: {
      type: String,
      enum: ['low', 'medium', 'high']
    },
    caloriesBurned: Number,
    notes: String
  },
  water: {
    amount: {
      type: Number,
      min: 0
    },
    unit: {
      type: String,
      enum: ['ml', 'oz', 'cups'],
      default: 'ml'
    }
  },
  comments: String,
  aiAnalysis: {
    summary: String,
    recommendations: [String],
    healthScore: {
      type: Number,
      min: 0,
      max: 100
    },
    goals: [String],
    warnings: [String],
    analyzedAt: Date
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
  
  // Calculate total nutrition from meals
  this.calculateTotalNutrition();
  
  next();
});

// Compound index to ensure one report per user per day
dailyReportSchema.index({ userId: 1, date: 1 }, { unique: true });

// Method to calculate total nutrition from meals
dailyReportSchema.methods.calculateTotalNutrition = function() {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0
  };
  
  this.meals.forEach(meal => {
    totals.calories += meal.calories || 0;
    totals.protein += meal.protein || 0;
    totals.carbs += meal.carbs || 0;
    totals.fat += meal.fat || 0;
    totals.fiber += meal.fiber || 0;
    totals.sugar += meal.sugar || 0;
    totals.sodium += meal.sodium || 0;
  });
  
  this.totalNutrition = totals;
};

// Method to add a meal
dailyReportSchema.methods.addMeal = function(mealData) {
  this.meals.push(mealData);
  this.calculateTotalNutrition();
};

// Method to remove a meal
dailyReportSchema.methods.removeMeal = function(mealId) {
  this.meals = this.meals.filter(meal => meal._id.toString() !== mealId.toString());
  this.calculateTotalNutrition();
};

// Method to get nutrition summary
dailyReportSchema.methods.getNutritionSummary = function() {
  return {
    totalCalories: this.totalNutrition.calories,
    totalProtein: this.totalNutrition.protein,
    totalCarbs: this.totalNutrition.carbs,
    totalFat: this.totalNutrition.fat,
    totalFiber: this.totalNutrition.fiber,
    totalSugar: this.totalNutrition.sugar,
    totalSodium: this.totalNutrition.sodium,
    mealCount: this.meals.length,
    mealBreakdown: this.getMealBreakdown()
  };
};

// Method to get meal breakdown by type
dailyReportSchema.methods.getMealBreakdown = function() {
  const breakdown = {};
  
  this.meals.forEach(meal => {
    if (!breakdown[meal.type]) {
      breakdown[meal.type] = {
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };
    }
    
    breakdown[meal.type].count++;
    breakdown[meal.type].calories += meal.calories || 0;
    breakdown[meal.type].protein += meal.protein || 0;
    breakdown[meal.type].carbs += meal.carbs || 0;
    breakdown[meal.type].fat += meal.fat || 0;
  });
  
  return breakdown;
};

// Static method to get reports by date range
dailyReportSchema.statics.getReportsByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

module.exports = mongoose.model('DailyReport', dailyReportSchema); 