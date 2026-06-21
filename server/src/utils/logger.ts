import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const GAME_LOG_FILE = path.join(LOG_DIR, `game-${Date.now()}.log`)

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'GAME'

interface LogEntry {
  timestamp: string
  level: LogLevel
  category: string
  message: string
  data?: Record<string, unknown>
}

function formatLog(entry: LogEntry): string {
  const dataStr = entry.data ? ` | ${JSON.stringify(entry.data)}` : ''
  return `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}${dataStr}\n`
}

function writeLog(entry: LogEntry): void {
  const formatted = formatLog(entry)

  // Write to file
  fs.appendFileSync(GAME_LOG_FILE, formatted)

  // Also log to console with color
  const colors: Record<LogLevel, string> = {
    INFO: '\x1b[36m', // Cyan
    WARN: '\x1b[33m', // Yellow
    ERROR: '\x1b[31m', // Red
    GAME: '\x1b[32m', // Green
  }
  const reset = '\x1b[0m'
  console.log(`${colors[entry.level]}${formatted.trim()}${reset}`)
}

export const logger = {
  info(category: string, message: string, data?: Record<string, unknown>): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category,
      message,
      data,
    })
  },

  warn(category: string, message: string, data?: Record<string, unknown>): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      category,
      message,
      data,
    })
  },

  error(category: string, message: string, data?: Record<string, unknown>): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      category,
      message,
      data,
    })
  },

  game(category: string, message: string, data?: Record<string, unknown>): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: 'GAME',
      category,
      message,
      data,
    })
  },

  getLogFilePath(): string {
    return GAME_LOG_FILE
  },
}
