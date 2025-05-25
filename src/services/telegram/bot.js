const TelegramBot = require('node-telegram-bot-api');
const User = require('../../models/User');
const DailyReport = require('../../models/DailyReport');
const ReportParser = require('../report/parser');
const OpenAIAnalyzer = require('../openai/analyzer');
const FatSecretAnalyzer = require('../fatsecret/analyzer');
const logger = require('../../utils/logger');

class TelegramBotService {
  constructor(token, openaiApiKey, fatSecretKey, fatSecretSecret) {
    this.bot = new TelegramBot(token, { polling: true });
    this.openaiAnalyzer = new OpenAIAnalyzer(openaiApiKey);
    this.fatSecretAnalyzer = new FatSecretAnalyzer(fatSecretKey, fatSecretSecret);
    this.reportParser = new ReportParser();
    this.setupCommands();
    this.setupMessageHandlers();
  }

  setupCommands() {
    this.bot.setMyCommands([
      { command: 'start', description: 'Почати роботу з ботом' },
      { command: 'report', description: 'Заповнити щоденний звіт' },
      { command: 'fatsecret', description: 'Імпорт даних з FatSecret' },
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
      case 'waiting_for_fatsecret_action':
        await this.handleFatSecretAction(msg, user);
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
      // Check if user wants to import from FatSecret
      if (text === '📱 Імпорт з FatSecret') {
        await this.importFromFatSecret(chatId, user);
        return;
      }
      
      // First, try to parse as a simple number
      const simpleCalories = parseInt(text);
      
      if (!isNaN(simpleCalories) && simpleCalories > 0 && simpleCalories <= 10000) {
        // Simple calorie input
        const nutrition = {
          calories: { value: simpleCalories, source: 'manual' }
        };
        user.updateInputState('waiting_for_training', { nutrition });
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
        await this.bot.sendMessage(chatId, 
          `✅ Калорії: ${simpleCalories}\n\nВиберіть тип тренування або пропустіть цей крок:`, 
          keyboard
        );
        return;
      }
      
      // If not a simple number, try to parse as food description using FatSecret
      if (text.length > 3) {
        await this.bot.sendMessage(chatId, '🔍 Аналізую продукти харчування через FatSecret...');
        
        const nutritionResult = await this.fatSecretAnalyzer.parseManualFoodInput(text);
        
        if (nutritionResult.success) {
          const nutrition = {
            calories: { value: nutritionResult.data.calories, source: 'fatsecret' },
            protein: nutritionResult.data.protein,
            carbs: nutritionResult.data.carbs,
            fat: nutritionResult.data.fat,
            fiber: nutritionResult.data.fiber,
            sugar: nutritionResult.data.sugar,
            sodium: nutritionResult.data.sodium,
            meals: nutritionResult.data.meals
          };
          
          user.updateInputState('waiting_for_training', { nutrition });
          await user.save();
          logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_training (FatSecret)`);
          
          // Format detailed nutrition message
          const nutritionMessage = this.fatSecretAnalyzer.formatNutritionMessage(nutritionResult.data);
          
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
          
          await this.bot.sendMessage(chatId, 
            `${nutritionMessage}\n\nВиберіть тип тренування або пропустіть цей крок:`, 
            keyboard
          );
          return;
        } else {
          // FatSecret parsing failed, ask for clarification
          await this.bot.sendMessage(chatId, 
            `❌ ${nutritionResult.error}\n\n` +
            'Ви можете ввести:\n' +
            '• Просто число калорій (наприклад: 2000)\n' +
            '• Список продуктів (наприклад: "2 яблука, 200г курка, 1 склянка рису")\n' +
            '• Або використати кнопку "📱 Імпорт з FatSecret"\n\n' +
            'Спробуйте ще раз:'
          );
          return;
        }
      }
      
      // Invalid input
      const keyboard = {
        reply_markup: {
          keyboard: [
            ['📱 Імпорт з FatSecret'],
            ['❌ Пропустити']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      
      await this.bot.sendMessage(chatId, 
        'Будь ласка, введіть:\n' +
        '• Кількість калорій (число від 1 до 10000)\n' +
        '• Або опишіть що ви їли (наприклад: "2 яблука, салат, 200г курка")\n' +
        '• Або використайте кнопку нижче для імпорту з FatSecret',
        keyboard
      );
      
    } catch (error) {
      logger.error('Error handling calories input:', error);
      await this.sendError(chatId, 'Помилка при обробці калорій');
    }
  }

  async importFromFatSecret(chatId, user) {
    try {
      await this.bot.sendMessage(chatId, '🔍 Імпортую дані з FatSecret...');
      
      // Use user's Telegram ID as FatSecret profile ID
      const userId = user.telegramId;
      const today = new Date();
      
      const nutritionResult = await this.fatSecretAnalyzer.getNutritionFromDiary(userId, today);
      
      if (nutritionResult.success) {
        const nutrition = {
          calories: { value: nutritionResult.data.calories, source: 'fatsecret' },
          protein: nutritionResult.data.protein,
          carbs: nutritionResult.data.carbs,
          fat: nutritionResult.data.fat,
          fiber: nutritionResult.data.fiber,
          sugar: nutritionResult.data.sugar,
          sodium: nutritionResult.data.sodium,
          meals: nutritionResult.data.meals
        };
        
        user.updateInputState('waiting_for_training', { nutrition });
        
        // Update user's FatSecret integration status
        if (!user.integrations.fatSecret.enabled) {
          user.integrations.fatSecret.enabled = true;
          user.integrations.fatSecret.profileId = userId;
          user.integrations.fatSecret.lastSync = new Date();
        }
        
        await user.save();
        logger.info(`[STEP] User ${user.username} (${user.telegramId}) -> waiting_for_training (FatSecret Import)`);
        
        // Format detailed nutrition message
        const nutritionMessage = this.fatSecretAnalyzer.formatDiaryByMeals(nutritionResult.data);
        
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
        
        await this.bot.sendMessage(chatId, 
          `${nutritionMessage}\nВиберіть тип тренування або пропустіть цей крок:`, 
          keyboard
        );
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ ${nutritionResult.error}\n\n` +
          'Переконайтеся, що ви додали продукти в FatSecret додаток на сьогодні.\n\n' +
          'Ви можете ввести дані вручну:'
        );
      }
    } catch (error) {
      logger.error('Error importing from FatSecret:', error);
      await this.sendError(chatId, 'Помилка при імпорті з FatSecret');
    }
  }

  async handleFatSecret(msg, user) {
    const chatId = msg.chat.id;
    
    try {
      const keyboard = {
        reply_markup: {
          keyboard: [
            ['📅 Сьогодні', '📅 Вчора'],
            ['📊 Цей тиждень', '📊 Цей місяць'],
            ['⚙️ Налаштування', '❌ Закрити']
          ],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      };
      
      await this.bot.sendMessage(chatId, 
        '📱 FatSecret Інтеграція\n\n' +
        'Виберіть період для імпорту даних з вашого FatSecret щоденника:',
        keyboard
      );
      
      // Set user state to handle FatSecret commands
      user.updateInputState('waiting_for_fatsecret_action');
      await user.save();
      
    } catch (error) {
      logger.error('Error handling FatSecret command:', error);
      await this.sendError(chatId, 'Помилка при обробці команди FatSecret');
    }
  }

  async handleFatSecretAction(msg, user) {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    try {
      // Reset user state
      user.updateInputState('idle');
      await user.save();
      
      const userId = user.telegramId;
      
      switch (text) {
        case '📅 Сьогодні':
          await this.importFatSecretDay(chatId, userId, new Date());
          break;
        case '📅 Вчора':
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          await this.importFatSecretDay(chatId, userId, yesterday);
          break;
        case '📊 Цей тиждень':
          await this.importFatSecretWeek(chatId, userId);
          break;
        case '📊 Цей місяць':
          const now = new Date();
          await this.importFatSecretMonth(chatId, userId, now.getFullYear(), now.getMonth() + 1);
          break;
        case '⚙️ Налаштування':
          await this.showFatSecretSettings(chatId, user);
          break;
        case '❌ Закрити':
          await this.bot.sendMessage(chatId, 'FatSecret меню закрито.', {
            reply_markup: { remove_keyboard: true }
          });
          break;
        default:
          await this.bot.sendMessage(chatId, 'Невідома дія. Використовуйте /fatsecret для відкриття меню.');
      }
    } catch (error) {
      logger.error('Error handling FatSecret action:', error);
      await this.sendError(chatId, 'Помилка при обробці FatSecret дії');
    }
  }

  async importFatSecretDay(chatId, userId, date) {
    try {
      await this.bot.sendMessage(chatId, `🔍 Імпортую дані з FatSecret за ${date.toLocaleDateString('uk-UA')}...`);
      
      const nutritionResult = await this.fatSecretAnalyzer.getNutritionFromDiary(userId, date);
      
      if (nutritionResult.success) {
        const nutritionMessage = this.fatSecretAnalyzer.formatDiaryByMeals(nutritionResult.data);
        await this.bot.sendMessage(chatId, nutritionMessage);
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ ${nutritionResult.error}\n\n` +
          'Переконайтеся, що ви додали продукти в FatSecret додаток на цю дату.'
        );
      }
    } catch (error) {
      logger.error('Error importing FatSecret day:', error);
      await this.sendError(chatId, 'Помилка при імпорті денних даних');
    }
  }

  async importFatSecretWeek(chatId, userId) {
    try {
      await this.bot.sendMessage(chatId, '🔍 Імпортую дані з FatSecret за тиждень...');
      
      const today = new Date();
      const weekData = [];
      
      // Get data for the last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const nutritionResult = await this.fatSecretAnalyzer.getNutritionFromDiary(userId, date);
        if (nutritionResult.success) {
          weekData.push({
            date: date,
            nutrition: nutritionResult.data
          });
        }
      }
      
      if (weekData.length === 0) {
        await this.bot.sendMessage(chatId, 'Немає даних у FatSecret за останній тиждень.');
        return;
      }
      
      // Format week summary
      let message = '📊 Тижневий звіт з FatSecret:\n\n';
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      
      weekData.forEach(day => {
        const dateStr = day.date.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
        message += `${dateStr}: ${Math.round(day.nutrition.calories)} ккал\n`;
        totalCalories += day.nutrition.calories;
        totalProtein += day.nutrition.protein;
        totalCarbs += day.nutrition.carbs;
        totalFat += day.nutrition.fat;
      });
      
      const avgCalories = totalCalories / weekData.length;
      message += `\n📈 Середнє за день: ${Math.round(avgCalories)} ккал\n`;
      message += `🥩 Білки: ${Math.round(totalProtein / weekData.length)}г\n`;
      message += `🍞 Вуглеводи: ${Math.round(totalCarbs / weekData.length)}г\n`;
      message += `🧈 Жири: ${Math.round(totalFat / weekData.length)}г`;
      
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Error importing FatSecret week:', error);
      await this.sendError(chatId, 'Помилка при імпорті тижневих даних');
    }
  }

  async importFatSecretMonth(chatId, userId, year, month) {
    try {
      await this.bot.sendMessage(chatId, `🔍 Імпортую дані з FatSecret за ${month}/${year}...`);
      
      const monthResult = await this.fatSecretAnalyzer.getNutritionFromDiaryMonth(userId, year, month);
      
      if (monthResult.success && monthResult.data.length > 0) {
        // Process month data (this would need more complex processing)
        await this.bot.sendMessage(chatId, 
          `📊 Знайдено ${monthResult.data.length} записів за ${month}/${year}\n\n` +
          'Детальний аналіз місячних даних буде додано в наступних оновленнях.'
        );
      } else {
        await this.bot.sendMessage(chatId, 
          `❌ Немає даних у FatSecret за ${month}/${year}`
        );
      }
    } catch (error) {
      logger.error('Error importing FatSecret month:', error);
      await this.sendError(chatId, 'Помилка при імпорті місячних даних');
    }
  }

  async showFatSecretSettings(chatId, user) {
    try {
      const isEnabled = user.integrations.fatSecret.enabled;
      const lastSync = user.integrations.fatSecret.lastSync;
      
      let message = '⚙️ Налаштування FatSecret:\n\n';
      message += `Статус: ${isEnabled ? '✅ Увімкнено' : '❌ Вимкнено'}\n`;
      
      if (lastSync) {
        message += `Остання синхронізація: ${lastSync.toLocaleString('uk-UA')}\n`;
      }
      
      message += '\nℹ️ FatSecret інтеграція дозволяє імпортувати дані з вашого щоденника харчування.\n';
      message += 'Переконайтеся, що ви ведете щоденник у FatSecret додатку.';
      
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      logger.error('Error showing FatSecret settings:', error);
      await this.sendError(chatId, 'Помилка при відображенні налаштувань');
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
      case '/fatsecret':
        await this.handleFatSecret(msg, user);
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
      '• /fatsecret - Імпорт даних з FatSecret\n' +
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