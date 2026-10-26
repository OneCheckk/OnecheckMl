const app = require('./app');
const env = require('./config/env');
const database = require('./config/database');
const logger = require('./config/logger');

let server;

async function startServer() {
  try {
    // Attempt database connection
    try {
      await database.connectDB();
      logger.info('Connected to MongoDB successfully');
    } catch (dbError) {
      logger.error('Failed to connect to MongoDB on startup. Application will boot with degraded database readiness.', {
        error: dbError.message
      });
    }

    server = app.listen(env.PORT, () => {
      logger.info(`OneCheck Backend running on port ${env.PORT}`, {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        healthEndpoint: `http://localhost:${env.PORT}/api/health`
      });
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Initiating graceful shutdown...`);
      if (server) {
        server.close(async () => {
          logger.info('HTTP server closed.');
          await database.disconnectDB();
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Fatal error during startup', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
