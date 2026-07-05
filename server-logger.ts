import fs from "fs";
import path from "path";
import crypto from "crypto";

const LOGS_DIR = path.join(process.cwd(), "data", "logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const APP_LOG_FILE = path.join(LOGS_DIR, "application.log");
const SECURITY_LOG_FILE = path.join(LOGS_DIR, "security.log");
const UPLOAD_LOG_FILE = path.join(LOGS_DIR, "upload.log");

function writeLog(filePath: string, level: string, type: string, message: string, errorId: string, metadata: any = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    errorId,
    level,
    type,
    message,
    metadata,
  };
  
  // Format log entry nicely (as a JSON line)
  const logLine = JSON.stringify(logEntry) + "\n";
  
  try {
    fs.appendFileSync(filePath, logLine, "utf-8");
  } catch (err) {
    console.error(`[Logger Error] Failed to write to log file ${filePath}:`, err);
  }

  // Also print to console for standard container logging (without stack traces in standard console logs unless requested)
  // We include metadata except raw stack if we want to keep it readable, but let's log the error message
  const msgSuffix = Object.keys(metadata).length ? ` | Metadata: ${JSON.stringify(metadata)}` : "";
  console.log(`[${level}] [${type}] [ID: ${errorId}] ${message}${msgSuffix}`);
}

export class Logger {
  // Generate unique error IDs
  public static generateErrorId(): string {
    return "err_" + crypto.randomBytes(8).toString("hex");
  }

  // 1. Application logs
  public static info(message: string, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    writeLog(APP_LOG_FILE, "INFO", "APPLICATION", message, errorId, metadata);
    return errorId;
  }

  public static error(message: string, error: any, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    const errorMeta = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    writeLog(APP_LOG_FILE, "ERROR", "APPLICATION", message, errorId, errorMeta);
    return errorId;
  }

  // 2. Database logs
  public static dbError(message: string, error: any, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    const errorMeta = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    writeLog(APP_LOG_FILE, "ERROR", "DATABASE", message, errorId, errorMeta);
    return errorId;
  }

  // 3. Security logs
  public static securityWarning(message: string, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    writeLog(SECURITY_LOG_FILE, "WARN", "SECURITY", message, errorId, metadata);
    return errorId;
  }

  public static securityFailure(message: string, error: any, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    const errorMeta = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    writeLog(SECURITY_LOG_FILE, "ERROR", "SECURITY", message, errorId, errorMeta);
    return errorId;
  }

  // 4. Upload logs
  public static uploadInfo(message: string, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    writeLog(UPLOAD_LOG_FILE, "INFO", "UPLOAD", message, errorId, metadata);
    return errorId;
  }

  public static uploadFailure(message: string, error: any, metadata: any = {}) {
    const errorId = Logger.generateErrorId();
    const errorMeta = {
      ...metadata,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    writeLog(UPLOAD_LOG_FILE, "ERROR", "UPLOAD", message, errorId, errorMeta);
    return errorId;
  }
}
