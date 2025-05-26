const express = require('express');
const Joi = require('joi');
const DailyReport = require('../models/DailyReport');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const OpenAIService = require('../services/openai/openaiService');

const router = express.Router();

// Initialize OpenAI service
const openaiService = new OpenAIService(process.env.OPENAI_API_KEY);

// Validation schemas
const imageSchema = Joi.object({
  data: Joi.string().required(), // base64 encoded
  mimeType: Joi.string().valid('image/jpeg', 'image/png', 'image/webp').required(),
  filename: Joi.string().optional()
});

const weightSchema = Joi.object({
  value: Joi.number().positive().max(500).required(),
  unit: Joi.string().valid('kg', 'lbs').default('kg'),
  source: Joi.string().valid('manual', 'image').default('manual'),
  image: imageSchema.optional()
});

const sleepSchema = Joi.object({
  duration: Joi.number().min(0).max(1440).optional(), // minutes
  quality: Joi.string().valid('poor', 'fair', 'good', 'excellent').optional(),
  bedtime: Joi.date().optional(),
  wakeupTime: Joi.date().optional(),
  source: Joi.string().valid('manual', 'image').default('manual'),
  image: imageSchema.optional(),
  notes: Joi.string().optional()
});

const stepsSchema = Joi.object({
  count: Joi.number().min(0).max(100000).required(),
  distance: Joi.object({
    value: Joi.number().positive().optional(),
    unit: Joi.string().valid('km', 'miles').default('km')
  }).optional(),
  activeMinutes: Joi.number().min(0).optional(),
  caloriesBurned: Joi.number().min(0).optional(),
  source: Joi.string().valid('manual', 'image').default('manual'),
  image: imageSchema.optional()
});

const mealSchema = Joi.object({
  type: Joi.string().valid('breakfast', 'lunch', 'dinner', 'snack', 'other').required(),
  description: Joi.string().optional(),
  calories: Joi.number().min(0).optional(),
  protein: Joi.number().min(0).optional(),
  carbs: Joi.number().min(0).optional(),
  fat: Joi.number().min(0).optional(),
  fiber: Joi.number().min(0).optional(),
  sugar: Joi.number().min(0).optional(),
  sodium: Joi.number().min(0).optional(),
  source: Joi.string().valid('manual', 'image', 'fatsecret').default('manual'),
  image: imageSchema.optional()
});

const dailyReportSchema = Joi.object({
  date: Joi.date().optional(),
  weight: weightSchema.optional(),
  sleep: sleepSchema.optional(),
  steps: stepsSchema.optional(),
  meals: Joi.array().items(mealSchema).optional(),
  mood: Joi.object({
    rating: Joi.number().min(1).max(10).optional(),
    notes: Joi.string().optional(),
    energy: Joi.number().min(1).max(10).optional(),
    stress: Joi.number().min(1).max(10).optional()
  }).optional(),
  exercise: Joi.object({
    type: Joi.string().optional(),
    duration: Joi.number().min(0).optional(),
    intensity: Joi.string().valid('low', 'medium', 'high').optional(),
    caloriesBurned: Joi.number().min(0).optional(),
    notes: Joi.string().optional()
  }).optional(),
  water: Joi.object({
    amount: Joi.number().min(0).optional(),
    unit: Joi.string().valid('ml', 'oz', 'cups').default('ml')
  }).optional(),
  comments: Joi.string().optional()
});

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get daily reports for the authenticated user
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering reports (YYYY-MM-DD)
 *         example: 2024-01-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering reports (YYYY-MM-DD)
 *         example: 2024-01-31
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 30
 *         description: Number of reports to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of reports to skip
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         reports:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DailyReport'
 *                         pagination:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                               description: Total number of reports
 *                             limit:
 *                               type: integer
 *                               description: Number of reports per page
 *                             offset:
 *                               type: integer
 *                               description: Number of reports skipped
 *                             hasMore:
 *                               type: boolean
 *                               description: Whether there are more reports
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get reports
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      limit = 30, 
      offset = 0 
    } = req.query;

    let query = { userId: req.userId };

    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const reports = await DailyReport.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await DailyReport.countDocuments(query);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: total > parseInt(offset) + parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get reports error:', error);
    res.status(500).json({
      error: 'Failed to get reports'
    });
  }
});

/**
 * @swagger
 * /api/reports/{date}:
 *   get:
 *     summary: Get daily report for a specific date
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date (YYYY-MM-DD)
 *         example: 2024-01-15
 *     responses:
 *       200:
 *         description: Report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         report:
 *                           $ref: '#/components/schemas/DailyReport'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    
    // Set to start of day
    reportDate.setHours(0, 0, 0, 0);

    const report = await DailyReport.findOne({
      userId: req.userId,
      date: reportDate
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'No report found for this date'
      });
    }

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    logger.error('Get report error:', error);
    res.status(500).json({
      error: 'Failed to get report'
    });
  }
});

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Create or update daily report
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Report date (defaults to today)
 *                 example: 2024-01-15
 *               weight:
 *                 type: object
 *                 properties:
 *                   value:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 500
 *                     example: 75.5
 *                   unit:
 *                     type: string
 *                     enum: [kg, lbs]
 *                     example: kg
 *                   source:
 *                     type: string
 *                     enum: [manual, image]
 *                     example: manual
 *                   image:
 *                     $ref: '#/components/schemas/Image'
 *               sleep:
 *                 type: object
 *                 properties:
 *                   duration:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1440
 *                     description: Sleep duration in minutes
 *                     example: 480
 *                   quality:
 *                     type: string
 *                     enum: [poor, fair, good, excellent]
 *                     example: good
 *                   bedtime:
 *                     type: string
 *                     format: date-time
 *                     description: Bedtime
 *                   wakeupTime:
 *                     type: string
 *                     format: date-time
 *                     description: Wake up time
 *                   notes:
 *                     type: string
 *                     description: Sleep notes
 *               steps:
 *                 type: object
 *                 properties:
 *                   count:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100000
 *                     example: 8500
 *                   distance:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: number
 *                         example: 6.8
 *                       unit:
 *                         type: string
 *                         enum: [km, miles]
 *                         example: km
 *                   activeMinutes:
 *                     type: number
 *                     example: 45
 *                   caloriesBurned:
 *                     type: number
 *                     example: 350
 *               meals:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Meal'
 *               mood:
 *                 type: object
 *                 properties:
 *                   rating:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 10
 *                     example: 8
 *                   notes:
 *                     type: string
 *                   energy:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 10
 *                     example: 7
 *                   stress:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 10
 *                     example: 3
 *               exercise:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: Running
 *                   duration:
 *                     type: number
 *                     example: 30
 *                   intensity:
 *                     type: string
 *                     enum: [low, medium, high]
 *                     example: medium
 *                   caloriesBurned:
 *                     type: number
 *                     example: 300
 *                   notes:
 *                     type: string
 *               water:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     example: 2000
 *                   unit:
 *                     type: string
 *                     enum: [ml, oz, cups]
 *                     example: ml
 *               comments:
 *                 type: string
 *                 description: Daily comments
 *     responses:
 *       200:
 *         description: Daily report saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         report:
 *                           $ref: '#/components/schemas/DailyReport'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to save report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', auth, async (req, res) => {
  try {
    // Validate input
    const { error, value } = dailyReportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    const reportDate = value.date ? new Date(value.date) : new Date();
    reportDate.setHours(0, 0, 0, 0);

    // Process meal images with AI if provided
    if (value.meals) {
      for (let meal of value.meals) {
        if (meal.image && meal.source === 'image') {
          try {
            const aiAnalysis = await openaiService.analyzeMealImage(meal.image.data, meal.type);
            meal.aiAnalysis = aiAnalysis;
            
            // Update nutrition values if AI provided them
            if (aiAnalysis.nutrition) {
              meal.calories = aiAnalysis.nutrition.calories || meal.calories;
              meal.protein = aiAnalysis.nutrition.protein || meal.protein;
              meal.carbs = aiAnalysis.nutrition.carbs || meal.carbs;
              meal.fat = aiAnalysis.nutrition.fat || meal.fat;
            }
          } catch (aiError) {
            logger.error('AI meal analysis error:', aiError);
            // Continue without AI analysis
          }
        }
      }
    }

    // Find existing report or create new one
    let report = await DailyReport.findOne({
      userId: req.userId,
      date: reportDate
    });

    if (report) {
      // Update existing report
      Object.assign(report, value);
      report.date = reportDate; // Ensure date doesn't change
    } else {
      // Create new report
      report = new DailyReport({
        ...value,
        userId: req.userId,
        date: reportDate
      });
    }

    await report.save();

    // Generate AI analysis if enabled
    if (process.env.ENABLE_AI_ANALYSIS === 'true') {
      try {
        const aiAnalysis = await openaiService.analyzeDailyReport(report, req.user);
        report.aiAnalysis = aiAnalysis;
        await report.save();
      } catch (aiError) {
        logger.error('AI daily analysis error:', aiError);
        // Continue without AI analysis
      }
    }

    logger.info(`Daily report ${report._id} saved for user ${req.userId}`);

    res.json({
      success: true,
      message: 'Daily report saved successfully',
      data: { report }
    });

  } catch (error) {
    logger.error('Save report error:', error);
    res.status(500).json({
      error: 'Failed to save report'
    });
  }
});

/**
 * @swagger
 * /api/reports/{date}:
 *   put:
 *     summary: Update specific fields of a daily report
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date (YYYY-MM-DD)
 *         example: 2024-01-15
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Only include fields you want to update
 *             properties:
 *               weight:
 *                 type: object
 *                 properties:
 *                   value:
 *                     type: number
 *                     example: 75.5
 *                   unit:
 *                     type: string
 *                     enum: [kg, lbs]
 *               sleep:
 *                 type: object
 *                 properties:
 *                   duration:
 *                     type: number
 *                     example: 480
 *                   quality:
 *                     type: string
 *                     enum: [poor, fair, good, excellent]
 *               mood:
 *                 type: object
 *                 properties:
 *                   rating:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 10
 *                     example: 8
 *               comments:
 *                 type: string
 *     responses:
 *       200:
 *         description: Daily report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         report:
 *                           $ref: '#/components/schemas/DailyReport'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to update report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    // Validate input
    const { error, value } = dailyReportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Find existing report
    let report = await DailyReport.findOne({
      userId: req.userId,
      date: reportDate
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found',
        message: 'No report found for this date'
      });
    }

    // Update only provided fields
    Object.assign(report, value);
    await report.save();

    logger.info(`Daily report ${report._id} updated for user ${req.userId}`);

    res.json({
      success: true,
      message: 'Daily report updated successfully',
      data: { report }
    });

  } catch (error) {
    logger.error('Update report error:', error);
    res.status(500).json({
      error: 'Failed to update report'
    });
  }
});

/**
 * @swagger
 * /api/reports/{date}/meals:
 *   post:
 *     summary: Add a meal to a daily report
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date (YYYY-MM-DD)
 *         example: 2024-01-15
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/Meal'
 *               - type: object
 *                 examples:
 *                   manual_meal:
 *                     summary: Manual meal entry
 *                     value:
 *                       type: breakfast
 *                       description: Oatmeal with berries
 *                       calories: 350
 *                       protein: 12
 *                       carbs: 65
 *                       fat: 8
 *                       source: manual
 *                   image_meal:
 *                     summary: Meal with image for AI analysis
 *                     value:
 *                       type: lunch
 *                       source: image
 *                       image:
 *                         data: base64_encoded_image_data
 *                         mimeType: image/jpeg
 *                         filename: lunch.jpg
 *     responses:
 *       200:
 *         description: Meal added successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         report:
 *                           $ref: '#/components/schemas/DailyReport'
 *                         addedMeal:
 *                           $ref: '#/components/schemas/Meal'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to add meal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:date/meals', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    // Validate meal data
    const { error, value } = mealSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }

    // Process meal image with AI if provided
    if (value.image && value.source === 'image') {
      try {
        const aiAnalysis = await openaiService.analyzeMealImage(value.image.data, value.type);
        value.aiAnalysis = aiAnalysis;
        
        // Update nutrition values if AI provided them
        if (aiAnalysis.nutrition) {
          value.calories = aiAnalysis.nutrition.calories || value.calories;
          value.protein = aiAnalysis.nutrition.protein || value.protein;
          value.carbs = aiAnalysis.nutrition.carbs || value.carbs;
          value.fat = aiAnalysis.nutrition.fat || value.fat;
        }
      } catch (aiError) {
        logger.error('AI meal analysis error:', aiError);
        // Continue without AI analysis
      }
    }

    // Find or create report
    let report = await DailyReport.findOne({
      userId: req.userId,
      date: reportDate
    });

    if (!report) {
      report = new DailyReport({
        userId: req.userId,
        date: reportDate,
        meals: []
      });
    }

    // Add meal
    report.addMeal(value);
    await report.save();

    logger.info(`Meal added to report ${report._id} for user ${req.userId}`);

    res.json({
      success: true,
      message: 'Meal added successfully',
      data: { 
        report,
        addedMeal: report.meals[report.meals.length - 1]
      }
    });

  } catch (error) {
    logger.error('Add meal error:', error);
    res.status(500).json({
      error: 'Failed to add meal'
    });
  }
});

/**
 * @swagger
 * /api/reports/{date}/meals/{mealId}:
 *   delete:
 *     summary: Remove a meal from a daily report
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date (YYYY-MM-DD)
 *         example: 2024-01-15
 *       - in: path
 *         name: mealId
 *         required: true
 *         schema:
 *           type: string
 *         description: Meal ID to remove
 *         example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Meal removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         report:
 *                           $ref: '#/components/schemas/DailyReport'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to remove meal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:date/meals/:mealId', auth, async (req, res) => {
  try {
    const { date, mealId } = req.params;
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const report = await DailyReport.findOne({
      userId: req.userId,
      date: reportDate
    });

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Remove meal
    report.removeMeal(mealId);
    await report.save();

    logger.info(`Meal ${mealId} removed from report ${report._id} for user ${req.userId}`);

    res.json({
      success: true,
      message: 'Meal removed successfully',
      data: { report }
    });

  } catch (error) {
    logger.error('Remove meal error:', error);
    res.status(500).json({
      error: 'Failed to remove meal'
    });
  }
});

/**
 * @swagger
 * /api/reports/stats/summary:
 *   get:
 *     summary: Get summary statistics for the user
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to include in statistics
 *         example: 30
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         period:
 *                           type: object
 *                           properties:
 *                             startDate:
 *                               type: string
 *                               format: date
 *                               description: Start date of the period
 *                             endDate:
 *                               type: string
 *                               format: date
 *                               description: End date of the period
 *                             days:
 *                               type: integer
 *                               description: Number of days in the period
 *                         stats:
 *                           type: object
 *                           properties:
 *                             totalReports:
 *                               type: integer
 *                               description: Total number of reports
 *                             averageWeight:
 *                               type: number
 *                               description: Average weight
 *                             averageCalories:
 *                               type: number
 *                               description: Average daily calories
 *                             averageSteps:
 *                               type: number
 *                               description: Average daily steps
 *                             averageSleep:
 *                               type: number
 *                               description: Average sleep duration in minutes
 *                             averageMood:
 *                               type: number
 *                               description: Average mood rating
 *                             weightTrend:
 *                               type: string
 *                               enum: [increasing, decreasing, stable]
 *                               description: Weight trend
 *                             mostCommonMealType:
 *                               type: string
 *                               description: Most frequently logged meal type
 *                             totalMeals:
 *                               type: integer
 *                               description: Total number of meals logged
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to get statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const reports = await DailyReport.getReportsByDateRange(req.userId, startDate, endDate);

    // Calculate statistics
    const stats = {
      totalReports: reports.length,
      averageWeight: 0,
      averageCalories: 0,
      averageSteps: 0,
      averageSleep: 0,
      averageMood: 0,
      weightTrend: 'stable', // 'increasing', 'decreasing', 'stable'
      mostCommonMealType: null,
      totalMeals: 0
    };

    if (reports.length > 0) {
      let totalWeight = 0, weightCount = 0;
      let totalCalories = 0, caloriesCount = 0;
      let totalSteps = 0, stepsCount = 0;
      let totalSleep = 0, sleepCount = 0;
      let totalMood = 0, moodCount = 0;
      let mealTypeCounts = {};

      reports.forEach(report => {
        if (report.weight?.value) {
          totalWeight += report.weight.value;
          weightCount++;
        }
        if (report.totalNutrition?.calories) {
          totalCalories += report.totalNutrition.calories;
          caloriesCount++;
        }
        if (report.steps?.count) {
          totalSteps += report.steps.count;
          stepsCount++;
        }
        if (report.sleep?.duration) {
          totalSleep += report.sleep.duration;
          sleepCount++;
        }
        if (report.mood?.rating) {
          totalMood += report.mood.rating;
          moodCount++;
        }

        // Count meal types
        report.meals.forEach(meal => {
          mealTypeCounts[meal.type] = (mealTypeCounts[meal.type] || 0) + 1;
          stats.totalMeals++;
        });
      });

      stats.averageWeight = weightCount > 0 ? totalWeight / weightCount : 0;
      stats.averageCalories = caloriesCount > 0 ? totalCalories / caloriesCount : 0;
      stats.averageSteps = stepsCount > 0 ? totalSteps / stepsCount : 0;
      stats.averageSleep = sleepCount > 0 ? totalSleep / sleepCount : 0;
      stats.averageMood = moodCount > 0 ? totalMood / moodCount : 0;

      // Find most common meal type
      if (Object.keys(mealTypeCounts).length > 0) {
        stats.mostCommonMealType = Object.keys(mealTypeCounts).reduce((a, b) => 
          mealTypeCounts[a] > mealTypeCounts[b] ? a : b
        );
      }

      // Calculate weight trend
      if (weightCount >= 2) {
        const firstWeight = reports[reports.length - 1].weight?.value;
        const lastWeight = reports[0].weight?.value;
        if (firstWeight && lastWeight) {
          const difference = lastWeight - firstWeight;
          if (difference > 1) stats.weightTrend = 'increasing';
          else if (difference < -1) stats.weightTrend = 'decreasing';
        }
      }
    }

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          days: parseInt(days)
        },
        stats
      }
    });

  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to get statistics'
    });
  }
});

/**
 * @swagger
 * /api/reports/{date}:
 *   delete:
 *     summary: Delete a daily report
 *     tags: [Daily Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date (YYYY-MM-DD)
 *         example: 2024-01-15
 *     responses:
 *       200:
 *         description: Daily report deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to delete report
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/:date', auth, async (req, res) => {
  try {
    const { date } = req.params;
    const reportDate = new Date(date);
    reportDate.setHours(0, 0, 0, 0);

    const result = await DailyReport.findOneAndDelete({
      userId: req.userId,
      date: reportDate
    });

    if (!result) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    logger.info(`Daily report deleted for user ${req.userId}, date ${date}`);

    res.json({
      success: true,
      message: 'Daily report deleted successfully'
    });

  } catch (error) {
    logger.error('Delete report error:', error);
    res.status(500).json({
      error: 'Failed to delete report'
    });
  }
});

module.exports = router; 