# SlimFit - Wellness Tracking API

A clean, modern REST API for wellness and health tracking. Built with Node.js, Express, and MongoDB.

## Features

### Core Functionality
- **User Authentication**: JWT-based authentication with secure password hashing
- **Daily Reports**: Comprehensive daily health tracking including:
  - Weight tracking (manual entry or image upload)
  - Sleep monitoring (duration, quality, bedtime/wake time)
  - Step counting and activity tracking
  - Meal logging with nutritional information
  - Mood and energy level tracking
  - Exercise logging
  - Water intake tracking
  - Personal comments and notes

### AI-Powered Features (Optional)
- **Meal Image Analysis**: Upload food photos for automatic nutritional analysis
- **Daily Report Insights**: AI-generated health recommendations and insights
- **Nutrition Extraction**: Automatic calorie and macronutrient calculation from meal images

### Data Management
- **Secure Storage**: All data encrypted and securely stored in MongoDB
- **Date-based Organization**: Reports organized by date for easy tracking
- **Statistics**: Comprehensive analytics and trend analysis
- **Data Export**: Easy data retrieval via REST API

### API Documentation
- **Interactive Swagger UI**: Comprehensive API documentation with live testing capabilities
- **OpenAPI 3.0 Specification**: Industry-standard API documentation format
- **Try It Out**: Test endpoints directly from the documentation interface

## Quick Start

1. **Clone and install**
```bash
git clone <repository-url>
cd slimfit
npm install
```

2. **Configure environment**
```bash
cp env.example .env
# Edit .env with your settings
```

3. **Start the server**
```bash
npm run dev
```

4. **View API Documentation**
Open your browser and go to: **http://localhost:3000**

The root URL automatically redirects to the interactive Swagger documentation at `/api-docs`.

## API Documentation

### Interactive Documentation
Visit **http://localhost:3000/api-docs** for the complete interactive API documentation powered by Swagger UI. The documentation includes:

- **Live API Testing**: Test endpoints directly from the browser
- **Request/Response Examples**: See exactly what data to send and expect
- **Authentication**: Built-in JWT token authentication testing
- **Schema Validation**: Complete data model documentation
- **Error Handling**: Detailed error response documentation

### Authentication in Swagger
1. Register a new user or login via the `/api/auth/register` or `/api/auth/login` endpoints
2. Copy the JWT token from the response
3. Click the "Authorize" button in Swagger UI
4. Enter `Bearer <your-jwt-token>` in the authorization field
5. Now you can test all protected endpoints

## API Endpoints

### Authentication
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - User login
GET  /api/auth/profile      - Get user profile
PUT  /api/auth/profile      - Update user profile
POST /api/auth/change-password - Change password
DELETE /api/auth/account    - Delete account
```

### Daily Reports
```
GET    /api/reports                    - Get user's daily reports
GET    /api/reports/:date              - Get specific date report
POST   /api/reports                    - Create/update daily report
PUT    /api/reports/:date              - Update specific report
DELETE /api/reports/:date              - Delete daily report

POST   /api/reports/:date/meals        - Add meal to report
DELETE /api/reports/:date/meals/:id    - Remove meal from report

GET    /api/reports/stats/summary      - Get user statistics
```

### Health Check
```
GET /health - API health status
```

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd slimfit
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp env.example .env
```

Edit `.env` with your configuration:
```env
MONGODB_URI=mongodb://localhost:27017/slimfit
JWT_SECRET=your-super-secret-jwt-key-here
OPENAI_API_KEY=your-openai-api-key-here  # Optional
PORT=3000
```

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

5. **Access API Documentation**
Open http://localhost:3000 in your browser to view the interactive API documentation.

## Usage Examples

### Using Swagger UI (Recommended)
The easiest way to explore and test the API is through the interactive Swagger documentation at http://localhost:3000/api-docs. You can:
- View all available endpoints
- See request/response schemas
- Test endpoints with real data
- Authenticate and test protected routes

### Using cURL

#### Register a New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "height": {"value": 180, "unit": "cm"},
    "goals": {"weightGoal": "lose", "targetWeight": 75}
  }'
```

#### Create Daily Report
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "date": "2024-01-15",
    "weight": {"value": 80, "unit": "kg", "source": "manual"},
    "sleep": {"duration": 480, "quality": "good"},
    "steps": {"count": 8500, "distance": {"value": 6.8, "unit": "km"}},
    "meals": [
      {
        "type": "breakfast",
        "description": "Oatmeal with berries",
        "calories": 350,
        "protein": 12,
        "carbs": 65,
        "fat": 8
      }
    ],
    "mood": {"rating": 8, "energy": 7},
    "water": {"amount": 2000, "unit": "ml"},
    "comments": "Feeling great today!"
  }'
```

#### Add Meal with Image Analysis
```bash
curl -X POST http://localhost:3000/api/reports/2024-01-15/meals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "lunch",
    "source": "image",
    "image": {
      "data": "base64_encoded_image_data",
      "mimeType": "image/jpeg",
      "filename": "lunch.jpg"
    }
  }'
```

## Data Models

### User
- Personal information (name, email, date of birth, gender)
- Physical attributes (height, weight goals)
- Activity level and preferences
- Authentication credentials

### Daily Report
- Date-specific health metrics
- Weight tracking with source (manual/image)
- Sleep data (duration, quality, times)
- Activity data (steps, distance, active minutes)
- Meal collection with nutritional information
- Mood and energy levels
- Exercise logging
- Water intake
- Personal comments
- AI analysis results (optional)

### Meal
- Type (breakfast, lunch, dinner, snack, other)
- Nutritional information (calories, macronutrients)
- Source (manual, image, fatsecret)
- Image data (base64 encoded)
- AI analysis results

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Joi schema validation
- **AI Integration**: OpenAI GPT-4 Vision API (optional)
- **Security**: Helmet, CORS, input sanitization
- **Logging**: Winston logger
- **Documentation**: Swagger/OpenAPI 3.0 with Swagger UI

## Development

### Scripts
```bash
npm run dev     # Start development server with nodemon
npm start       # Start production server
npm test        # Run tests
```

### Project Structure
```
slimfit/
├── src/
│   ├── config/           # Configuration files
│   │   └── swagger.js    # Swagger/OpenAPI configuration
│   ├── models/           # Database models
│   │   ├── User.js
│   │   └── DailyReport.js
│   ├── routes/           # API routes
│   │   ├── authRoutes.js
│   │   └── dailyReportRoutes.js
│   ├── services/         # Business logic
│   │   └── openai/
│   │       └── openaiService.js
│   ├── middleware/       # Custom middleware
│   │   └── auth.js
│   ├── utils/           # Utility functions
│   │   └── logger.js
│   └── index.js         # Application entry point
├── logs/                # Log files
├── env.example          # Environment variables template
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | Secret key for JWT tokens | Yes | - |
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment (development/production) | No | development |
| `OPENAI_API_KEY` | OpenAI API key for AI features | No | - |
| `ENABLE_AI_ANALYSIS` | Enable AI analysis features | No | true |
| `FRONTEND_URL` | Frontend URL for CORS | No | http://localhost:3000 |
| `LOG_LEVEL` | Logging level | No | info |

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Joi schema validation for all inputs
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers and protection
- **Rate Limiting**: Built-in protection against abuse
- **Data Sanitization**: Input sanitization and validation

## AI Features

When `OPENAI_API_KEY` is provided, the API supports:

1. **Meal Image Analysis**: Upload food photos to automatically extract:
   - Food item identification
   - Portion size estimation
   - Calorie calculation
   - Macronutrient breakdown (protein, carbs, fat)
   - Micronutrient information (fiber, sugar, sodium)
   - Health score and recommendations

2. **Daily Report Analysis**: AI-powered insights including:
   - Health score calculation
   - Personalized recommendations
   - Goal suggestions
   - Health warnings and alerts
   - Trend analysis

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License 