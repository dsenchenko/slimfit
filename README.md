# SlimFit - AI-Powered Wellness Assistant

An intelligent wellness assistant that helps users achieve their health and fitness goals through personalized AI-powered feedback and analysis.

## Features

- Telegram bot interface for easy interaction
- Daily health and fitness reporting
- Integration with Garmin Connect for training data
- Integration with FatSecret for nutrition tracking
- AI-powered analysis and feedback using OpenAI
- Secure data storage and analysis
- Future support for web interface and API

## Project Structure

```
slimfit/
├── src/
│   ├── config/         # Configuration files
│   ├── models/         # Database models
│   ├── services/       # Business logic
│   │   ├── telegram/   # Telegram bot service
│   │   ├── openai/     # OpenAI integration
│   │   ├── garmin/     # Garmin Connect integration
│   │   └── fatsecret/  # FatSecret API integration
│   ├── utils/          # Utility functions
│   └── index.js        # Application entry point
├── tests/              # Test files
├── .env.example        # Environment variables template
├── .gitignore         # Git ignore rules
└── package.json       # Project dependencies
```

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in your environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

The following environment variables are required:

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `OPENAI_API_KEY`: Your OpenAI API key
- `MONGODB_URI`: MongoDB connection string
- `FATSECRET_API_KEY`: FatSecret API key
- `FATSECRET_API_SECRET`: FatSecret API secret
- `GARMIN_CONNECT_CLIENT_ID`: Garmin Connect client ID
- `GARMIN_CONNECT_CLIENT_SECRET`: Garmin Connect client secret
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging level (default: info)

## Development

- `npm run dev`: Start development server with hot reload
- `npm test`: Run tests
- `npm run lint`: Run linter

## License

ISC 