const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  firstName: String,
  lastName: String,
  language: {
    type: String,
    enum: ['uk', 'en'],
    default: 'uk'
  },
  timezone: {
    type: String,
    default: 'Europe/Kiev'
  },
  settings: {
    notifications: {
      enabled: {
        type: Boolean,
        default: true
      },
      reminderTime: {
        type: String,
        default: '20:00'
      }
    }
  },
  inputState: {
    state: {
      type: String,
      enum: [
        'idle',
        'waiting_for_input_method',
        'waiting_for_weight',
        'waiting_for_steps',
        'waiting_for_sleep',
        'waiting_for_calories',
        'waiting_for_training',
        'waiting_for_mood',
        'waiting_for_comments'
      ],
      default: 'idle'
    },
    currentReport: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    lastMessageId: Number,
    lastStepTimestamp: Date
  },
  integrations: {
    garminConnect: {
      enabled: {
        type: Boolean,
        default: false
      },
      accessToken: String,
      refreshToken: String,
      tokenExpiresAt: Date
    },
    fatSecret: {
      enabled: {
        type: Boolean,
        default: false
      },
      accessToken: String,
      refreshToken: String,
      tokenExpiresAt: Date
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// Update lastActive timestamp on save
userSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

// Method to reset input state
userSchema.methods.resetInputState = function() {
  this.inputState = {
    state: 'idle',
    currentReport: {},
    lastMessageId: null,
    lastStepTimestamp: null
  };
};

// Method to update input state
userSchema.methods.updateInputState = function(state, reportData = null) {
  this.inputState.state = state;
  this.inputState.lastStepTimestamp = new Date();
  if (reportData) {
    this.inputState.currentReport = {
      ...this.inputState.currentReport,
      ...reportData
    };
  }
};

module.exports = mongoose.model('User', userSchema); 