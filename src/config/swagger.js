const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SlimFit API',
      version: '1.0.0',
      description: 'A comprehensive wellness tracking API for managing daily health reports, meals, exercise, and more.',
      contact: {
        name: 'SlimFit Team',
        email: 'support@slimfit.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
              example: '507f1f77bcf86cd799439011'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'user@example.com'
            },
            firstName: {
              type: 'string',
              description: 'User first name',
              example: 'John'
            },
            lastName: {
              type: 'string',
              description: 'User last name',
              example: 'Doe'
            },
            dateOfBirth: {
              type: 'string',
              format: 'date',
              description: 'User date of birth',
              example: '1990-01-01'
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other'],
              description: 'User gender'
            },
            height: {
              type: 'object',
              properties: {
                value: {
                  type: 'number',
                  description: 'Height value',
                  example: 180
                },
                unit: {
                  type: 'string',
                  enum: ['cm', 'ft'],
                  description: 'Height unit',
                  example: 'cm'
                }
              }
            },
            activityLevel: {
              type: 'string',
              enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
              description: 'User activity level',
              example: 'moderately_active'
            },
            goals: {
              type: 'object',
              properties: {
                weightGoal: {
                  type: 'string',
                  enum: ['lose', 'maintain', 'gain'],
                  description: 'Weight goal',
                  example: 'lose'
                },
                targetWeight: {
                  type: 'number',
                  description: 'Target weight in kg',
                  example: 75
                },
                weeklyGoal: {
                  type: 'number',
                  description: 'Weekly weight change goal in kg',
                  example: -0.5
                }
              }
            },
            preferences: {
              type: 'object',
              properties: {
                units: {
                  type: 'object',
                  properties: {
                    weight: {
                      type: 'string',
                      enum: ['kg', 'lbs'],
                      example: 'kg'
                    },
                    distance: {
                      type: 'string',
                      enum: ['km', 'miles'],
                      example: 'km'
                    }
                  }
                },
                timezone: {
                  type: 'string',
                  description: 'User timezone',
                  example: 'UTC'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation date'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login date'
            }
          }
        },
        DailyReport: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Report ID',
              example: '507f1f77bcf86cd799439011'
            },
            userId: {
              type: 'string',
              description: 'User ID',
              example: '507f1f77bcf86cd799439011'
            },
            date: {
              type: 'string',
              format: 'date',
              description: 'Report date',
              example: '2024-01-15'
            },
            weight: {
              type: 'object',
              properties: {
                value: {
                  type: 'number',
                  description: 'Weight value',
                  example: 75.5
                },
                unit: {
                  type: 'string',
                  enum: ['kg', 'lbs'],
                  example: 'kg'
                },
                source: {
                  type: 'string',
                  enum: ['manual', 'image'],
                  example: 'manual'
                },
                image: {
                  $ref: '#/components/schemas/Image'
                }
              }
            },
            sleep: {
              type: 'object',
              properties: {
                duration: {
                  type: 'number',
                  description: 'Sleep duration in minutes',
                  example: 480
                },
                quality: {
                  type: 'string',
                  enum: ['poor', 'fair', 'good', 'excellent'],
                  example: 'good'
                },
                bedtime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Bedtime'
                },
                wakeupTime: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Wake up time'
                },
                source: {
                  type: 'string',
                  enum: ['manual', 'image'],
                  example: 'manual'
                },
                notes: {
                  type: 'string',
                  description: 'Sleep notes'
                }
              }
            },
            steps: {
              type: 'object',
              properties: {
                count: {
                  type: 'number',
                  description: 'Step count',
                  example: 8500
                },
                distance: {
                  type: 'object',
                  properties: {
                    value: {
                      type: 'number',
                      description: 'Distance value',
                      example: 6.8
                    },
                    unit: {
                      type: 'string',
                      enum: ['km', 'miles'],
                      example: 'km'
                    }
                  }
                },
                activeMinutes: {
                  type: 'number',
                  description: 'Active minutes',
                  example: 45
                },
                caloriesBurned: {
                  type: 'number',
                  description: 'Calories burned',
                  example: 350
                },
                source: {
                  type: 'string',
                  enum: ['manual', 'image'],
                  example: 'manual'
                }
              }
            },
            meals: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Meal'
              }
            },
            totalNutrition: {
              $ref: '#/components/schemas/Nutrition'
            },
            mood: {
              type: 'object',
              properties: {
                rating: {
                  type: 'number',
                  minimum: 1,
                  maximum: 10,
                  description: 'Mood rating',
                  example: 8
                },
                notes: {
                  type: 'string',
                  description: 'Mood notes'
                },
                energy: {
                  type: 'number',
                  minimum: 1,
                  maximum: 10,
                  description: 'Energy level',
                  example: 7
                },
                stress: {
                  type: 'number',
                  minimum: 1,
                  maximum: 10,
                  description: 'Stress level',
                  example: 3
                }
              }
            },
            exercise: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'Exercise type',
                  example: 'Running'
                },
                duration: {
                  type: 'number',
                  description: 'Exercise duration in minutes',
                  example: 30
                },
                intensity: {
                  type: 'string',
                  enum: ['low', 'medium', 'high'],
                  example: 'medium'
                },
                caloriesBurned: {
                  type: 'number',
                  description: 'Calories burned',
                  example: 300
                },
                notes: {
                  type: 'string',
                  description: 'Exercise notes'
                }
              }
            },
            water: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'Water amount',
                  example: 2000
                },
                unit: {
                  type: 'string',
                  enum: ['ml', 'oz', 'cups'],
                  example: 'ml'
                }
              }
            },
            comments: {
              type: 'string',
              description: 'Daily comments'
            },
            aiAnalysis: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'AI-generated summary'
                },
                recommendations: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'AI recommendations'
                },
                healthScore: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Health score'
                },
                goals: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Suggested goals'
                },
                warnings: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Health warnings'
                }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update date'
            }
          }
        },
        Meal: {
          type: 'object',
          required: ['type'],
          properties: {
            _id: {
              type: 'string',
              description: 'Meal ID'
            },
            type: {
              type: 'string',
              enum: ['breakfast', 'lunch', 'dinner', 'snack', 'other'],
              description: 'Meal type',
              example: 'breakfast'
            },
            description: {
              type: 'string',
              description: 'Meal description',
              example: 'Oatmeal with berries'
            },
            calories: {
              type: 'number',
              minimum: 0,
              description: 'Calories',
              example: 350
            },
            protein: {
              type: 'number',
              minimum: 0,
              description: 'Protein in grams',
              example: 12
            },
            carbs: {
              type: 'number',
              minimum: 0,
              description: 'Carbohydrates in grams',
              example: 65
            },
            fat: {
              type: 'number',
              minimum: 0,
              description: 'Fat in grams',
              example: 8
            },
            fiber: {
              type: 'number',
              minimum: 0,
              description: 'Fiber in grams',
              example: 5
            },
            sugar: {
              type: 'number',
              minimum: 0,
              description: 'Sugar in grams',
              example: 15
            },
            sodium: {
              type: 'number',
              minimum: 0,
              description: 'Sodium in milligrams',
              example: 200
            },
            source: {
              type: 'string',
              enum: ['manual', 'image', 'fatsecret'],
              description: 'Data source',
              example: 'manual'
            },
            image: {
              $ref: '#/components/schemas/Image'
            },
            aiAnalysis: {
              type: 'object',
              properties: {
                recognized: {
                  type: 'boolean',
                  description: 'Whether food was recognized'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 100,
                  description: 'Recognition confidence'
                },
                suggestions: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'AI suggestions'
                }
              }
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Meal timestamp'
            }
          }
        },
        Nutrition: {
          type: 'object',
          properties: {
            calories: {
              type: 'number',
              minimum: 0,
              description: 'Total calories',
              example: 2000
            },
            protein: {
              type: 'number',
              minimum: 0,
              description: 'Total protein in grams',
              example: 120
            },
            carbs: {
              type: 'number',
              minimum: 0,
              description: 'Total carbohydrates in grams',
              example: 250
            },
            fat: {
              type: 'number',
              minimum: 0,
              description: 'Total fat in grams',
              example: 70
            },
            fiber: {
              type: 'number',
              minimum: 0,
              description: 'Total fiber in grams',
              example: 25
            },
            sugar: {
              type: 'number',
              minimum: 0,
              description: 'Total sugar in grams',
              example: 50
            },
            sodium: {
              type: 'number',
              minimum: 0,
              description: 'Total sodium in milligrams',
              example: 2300
            }
          }
        },
        Image: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'Base64 encoded image data',
              example: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
            },
            mimeType: {
              type: 'string',
              enum: ['image/jpeg', 'image/png', 'image/webp'],
              description: 'Image MIME type',
              example: 'image/jpeg'
            },
            filename: {
              type: 'string',
              description: 'Image filename',
              example: 'meal.jpg'
            },
            uploadedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Upload timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Error details'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Path to the API files
};

const specs = swaggerJsdoc(options);

module.exports = specs; 