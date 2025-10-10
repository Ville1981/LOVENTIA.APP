// --- REPLACE START: minimal Winston logger with env control ---
import winston from 'winston';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true
    }),
  ],
  exitOnError: false,
});

export default logger;
// --- REPLACE END ---
