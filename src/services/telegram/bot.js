const TelegramBot = require('node-telegram-bot-api');
const User = require('../../models/User');
const DailyReport = require('../../models/DailyReport');
const ReportParser = require('../report/parser');
const OpenAIAnalyzer = require('../openai/analyzer');
const logger = require('../../utils/logger');

class TelegramBotService {
  constructor(token, openaiApiKey) {
    this.bot = new TelegramBot(token, { polling: true });
    this.openaiAnalyzer = new OpenAIAnalyzer(openaiApiKey);
    this.reportParser = new ReportParser();
    this.setupCommands();
    this.setupMessageHandlers();
  }

  setupCommands() {
    this.bot.setMyCommands([
      { command: 'start', description: 'Почати роботу з ботом' },
      { command: 'report', description: 'Заповнити щоденний звіт' },
      { command: 'stats', description: 'Переглянути статистику' },
      { command: 'settings', description: 'Налаштування' },
      { command: 'help', description: 'Довідка' }
    ]);
  }

  setupMessageHandlers() {
    this.bot.on('message', async (msg) => {
      try {
        const user = await this.getOrCreateUser(msg.from);
        
        // Handle photo messages (screenshots)
        if (msg.photo) {
          await this.handleScreenshot(msg, user);
          return;
        }

        // Handle text messages based on user's input state
        if (msg.text) {
          if (msg.text.startsWith('/')) {
            await this.handleCommand(msg, user);
          } else {
            await this.handleInputState(msg, user);
          }
        }
      } catch (error) {
        logger.error('Error handling message:', error);
        await this.sendError(msg.chat.id, 'Сталася помилка при обробці повідомлення');
      }
    });
  }

  async handleInputState(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;

    // If user sends a screenshot at any step, handle it
    if (msg.photo) {
      await this.handleScreenshot(msg, user);
      return;
    }

    switch (user.inputState.state) {
      case 'waiting_for_weight':
        // Only accept valid weight input
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Будь ласка, введіть вашу вагу у форматі "XX.X кг" або "XX.X lbs"');
          return;
        }
        await this.handleWeightInput(msg, user);
        break;
      case 'waiting_for_steps':
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Будь ласка, введіть кількість кроків (ціле число)');
          return;
        }
        await this.handleStepsInput(msg, user);
        break;
      case 'waiting_for_sleep':
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Будь ласка, введіть тривалість сну у форматі "X годин" або "X:XX" (години:хвилини)');
          return;
        }
        await this.handleSleepInput(msg, user);
        break;
      case 'waiting_for_calories':
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Будь ласка, введіть кількість калорій (ціле число)');
          return;
        }
        await this.handleCaloriesInput(msg, user);
        break;
      case 'waiting_for_training':
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Будь ласка, виберіть тип тренування з клавіатури або пропустіть цей крок');
          return;
        }
        await this.handleTrainingInput(msg, user);
        break;
      case 'waiting_for_mood':
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Будь ласка, виберіть настрій з клавіатури або пропустіть цей крок');
          return;
        }
        await this.handleMoodInput(msg, user);
        break;
      case 'waiting_for_comments':
        if (text && (text === '✏️ Ввести вручну' || text === '📸 Надіслати скріншот' || text === '❌ Скасувати')) {
          await this.bot.sendMessage(chatId, 'Введіть коментар або натисніть "Завершити без коментарів"');
          return;
        }
        await this.handleCommentsInput(msg, user);
        break;
      default:
        await this.bot.sendMessage(chatId, 'Будь ласка, використовуйте команди для взаємодії з ботом');
    }
  }

  async handleScreenshot(msg, user) {
    const chatId = msg.chat.id;
    const photo = msg.photo[msg.photo.length - 1]; // Get the highest quality photo

    try {
      // Download the photo
      const file = await this.bot.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

      // TODO: Implement OCR to extract data from screenshot
      // For now, just acknowledge receipt
      await this.bot.sendMessage(chatId, 
        'Я отримав ваш скріншот. Наразі функція розпізнавання даних зі скріншотів знаходиться в розробці. ' +
        'Будь ласка, введіть дані вручну.'
      );

      // Start manual input process
      await this.startReportInput(chatId, user);
    } catch (error) {
      logger.error('Error handling screenshot:', error);
      await this.sendError(chatId, 'Помилка при обробці скріншоту');
    }
  }

  async startReportInput(chatId, user) {
    // Immediately start with weight input, no method selection
    user.updateInputState('waiting_for_weight');
    await user.save();
    await this.bot.sendMessage(chatId, 'Введіть вашу вагу у форматі "XX.X кг" або "XX.X lbs"');
  }

  async handleWeightInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered weight: ${text}`);
    try {
      // Accept only a number (kg)
      const value = parseFloat(text.replace(',', '.'));
      if (isNaN(value) || value < 20 || value > 300) {
        await this.bot.sendMessage(chatId, 'Будь ласка, введіть вашу вагу у кг (наприклад: 75.5)');
        return;
      }
      const weight = { value, unit: 'kg', source: 'manual' };
      user.updateInputState('waiting_for_steps', { weight });
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_steps`);
      await this.bot.sendMessage(chatId, 'Чудово! Тепер введіть кількість кроків за день:');
    } catch (error) {
      logger.error('Error handling weight input:', error);
      await this.sendError(chatId, 'Помилка при обробці ваги');
    }
  }

  async handleStepsInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered steps: ${text}`);
    try {
      const steps = parseInt(text);
      if (isNaN(steps) || steps < 0) {
        await this.bot.sendMessage(chatId, 'Будь ласка, введіть коректну кількість кроків (ціле число)');
        return;
      }
      user.updateInputState('waiting_for_sleep', { steps });
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_sleep`);
      await this.bot.sendMessage(chatId, 'Добре! Тепер введіть тривалість сну у форматі "X годин" або "X:XX" (години:хвилини):');
    } catch (error) {
      logger.error('Error handling steps input:', error);
      await this.sendError(chatId, 'Помилка при обробці кроків');
    }
  }

  async handleSleepInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered sleep: ${text}`);
    try {
      const sleep = this.reportParser.parseSleep(text);
      if (!sleep) {
        await this.bot.sendMessage(chatId, 'Будь ласка, введіть тривалість сну у форматі "X годин" або "X:XX" (години:хвилини)');
        return;
      }
      user.updateInputState('waiting_for_calories', { sleep });
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_calories`);
      await this.bot.sendMessage(chatId, 'Чудово! Тепер введіть кількість калорій за день:');
    } catch (error) {
      logger.error('Error handling sleep input:', error);
      await this.sendError(chatId, 'Помилка при обробці даних про сон');
    }
  }

  async handleCaloriesInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered calories: ${text}`);
    try {
      const calories = parseInt(text);
      if (isNaN(calories) || calories < 0) {
        await this.bot.sendMessage(chatId, 'Будь ласка, введіть коректну кількість калорій (ціле число)');
        return;
      }
      user.updateInputState('waiting_for_training', { calories });
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_training`);
      const keyboard = {
        reply_markup: {
          keyboard: [
            ['🏃 Біг', '🚴 Велосипед', '🏋️ Тренування'],
            ['🏊 Плавання', '🚶 Ходьба', '⛹️ Інше'],
            ['❌ Пропустити']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      await this.bot.sendMessage(chatId, 'Виберіть тип тренування або пропустіть цей крок:', keyboard);
    } catch (error) {
      logger.error('Error handling calories input:', error);
      await this.sendError(chatId, 'Помилка при обробці калорій');
    }
  }

  async handleTrainingInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered training: ${text}`);
    if (text === '❌ Пропустити') {
      user.updateInputState('waiting_for_mood');
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_mood`);
      await this.askForMood(chatId);
      return;
    }
    try {
      const training = this.reportParser.parseTraining(text);
      if (!training) {
        await this.bot.sendMessage(chatId, 'Будь ласка, виберіть тип тренування з клавіатури або пропустіть цей крок');
        return;
      }
      user.updateInputState('waiting_for_mood', { training });
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_mood`);
      await this.askForMood(chatId);
    } catch (error) {
      logger.error('Error handling training input:', error);
      await this.sendError(chatId, 'Помилка при обробці даних про тренування');
    }
  }

  async askForMood(chatId) {
    const keyboard = {
      reply_markup: {
        keyboard: [
          ['😊 Чудово', '🙂 Добре', '😐 Нормально'],
          ['😔 Погано', '😢 Дуже погано'],
          ['❌ Пропустити']
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      'Як ви себе почуваєте сьогодні?',
      keyboard
    );
  }

  async handleMoodInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered mood: ${text}`);
    if (text === '❌ Пропустити') {
      user.updateInputState('waiting_for_comments');
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_comments`);
      await this.askForComments(chatId);
      return;
    }
    try {
      const mood = this.reportParser.parseMood(text);
      if (!mood) {
        await this.bot.sendMessage(chatId, 'Будь ласка, виберіть настрій з клавіатури або пропустіть цей крок');
        return;
      }
      user.updateInputState('waiting_for_comments', { mood });
      await user.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_comments`);
      await this.askForComments(chatId);
    } catch (error) {
      logger.error('Error handling mood input:', error);
      await this.sendError(chatId, 'Помилка при обробці настрою');
    }
  }

  async askForComments(chatId) {
    const keyboard = {
      reply_markup: {
        keyboard: [
          [{ text: '✅ Завершити без коментарів' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      'Чи хочете додати коментар до звіту? (необов\'язково)',
      keyboard
    );
  }

  async handleCommentsInput(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    logger.info(`[STEP] User ${user.username} (${user.telegramId}) entered comments: ${text}`);
    try {
      if (text !== '✅ Завершити без коментарів') {
        user.updateInputState('idle', { comments: text });
      }
      // Create and save the report
      const report = new DailyReport({
        userId: user._id,
        date: new Date(),
        ...user.inputState.currentReport
      });
      await report.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) report saved. Running OpenAI analysis...`);
      // Get AI feedback
      const feedback = await this.openaiAnalyzer.analyzeReport(report, user);
      // Update report with AI feedback
      report.aiFeedback = feedback;
      await report.save();
      logger.info(`[STEP] User ${user.username} (${user.telegramId}) OpenAI analysis complete.`);
      // Reset user's input state
      user.resetInputState();
      await user.save();
      // Send confirmation with AI feedback
      await this.bot.sendMessage(chatId, '✅ Звіт успішно збережено!\n\n' + '📊 Аналіз:\n' + feedback.analysis + '\n\n' + '💡 Рекомендації:\n' + feedback.recommendations + '\n\n' + '🎯 Цілі:\n' + feedback.goals, { parse_mode: 'HTML' });
      // Reset keyboard
      await this.bot.sendMessage(chatId, 'Що бажаєте зробити далі?', { reply_markup: { remove_keyboard: true } });
    } catch (error) {
      logger.error('Error handling comments input:', error);
      await this.sendError(chatId, 'Помилка при збереженні звіту');
    }
  }

  async handleCommand(msg, user) {
    const chatId = msg.chat.id;
    const command = msg.text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
        await this.handleStart(msg, user);
        break;
      case '/report':
        await this.startReportInput(chatId, user);
        break;
      case '/stats':
        await this.handleStats(msg, user);
        break;
      case '/settings':
        await this.handleSettings(msg, user);
        break;
      case '/help':
        await this.handleHelp(msg, user);
        break;
      default:
        await this.bot.sendMessage(chatId, 'Невідома команда. Використовуйте /help для списку команд.');
    }
  }

  async getOrCreateUser(telegramUser) {
    try {
      let user = await User.findOne({ telegramId: telegramUser.id.toString() });
      
      if (!user) {
        user = new User({
          telegramId: telegramUser.id.toString(),
          username: telegramUser.username || `user_${telegramUser.id}`,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name
        });
        await user.save();
        logger.info(`Created new user: ${user.username}`);
      }
      
      return user;
    } catch (error) {
      logger.error('Error in getOrCreateUser:', error);
      throw error;
    }
  }

  async handleStart(msg, user) {
    const chatId = msg.chat.id;
    const welcomeMessage = `Вітаю в SlimFit, ${user.firstName}! 🎉\n\n` +
      "Я ваш AI-асистент для здорового способу життя. Я допоможу вам відстежувати ваш шлях до здоров'я та фітнесу.\n\n" +
      'Використовуйте /report для відправки щоденного звіту\n' +
      'Використовуйте /stats для перегляду прогресу\n' +
      'Використовуйте /settings для налаштувань\n' +
      'Використовуйте /help для отримання довідки';

    await this.bot.sendMessage(chatId, welcomeMessage);
  }

  async handleStats(msg, user) {
    // Implementation of handleStats method
  }

  async handleSettings(msg, user) {
    // Implementation of handleSettings method
  }

  async handleHelp(msg, user) {
    const helpMessage = '📚 *Довідка SlimFit Bot*\n\n' +
      '*Доступні команди:*\n' +
      '• /start - Почати використання бота\n' +
      '• /report - Відправити щоденний звіт\n' +
      '• /stats - Переглянути статистику\n' +
      '• /settings - Керувати налаштуваннями\n\n' +
      '*Інструкція щодо звіту:*\n' +
      'При відправці звіту ви можете вказати:\n' +
      '• Вагу\n' +
      '• Калорії та харчування\n' +
      '• Тренування\n' +
      '• Настрій та сон\n' +
      '• Додаткові коментарі\n\n' +
      'Ви також можете підключити свої облікові записи Garmin Connect та FatSecret в налаштуваннях для автоматичної синхронізації даних.';

    await this.bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
  }

  async sendError(chatId, message) {
    await this.bot.sendMessage(chatId, `❌ ${message}`);
  }
}

module.exports = TelegramBotService; 