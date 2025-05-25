require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBotService = require('./services/telegram/bot');
const logger = require('./utils/logger');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Initialize Telegram bot with OpenAI integration
const botService = new TelegramBotService(
  process.env.TELEGRAM_BOT_TOKEN,
  process.env.OPENAI_API_KEY
);
logger.info('Telegram bot service initialized');

// Basic error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
});

// Start the server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});

// Export for testing
module.exports = { app, botService }; 