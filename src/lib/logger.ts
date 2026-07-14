export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

class Logger {
  private async sendLog(payload: LogPayload) {
    // Always log to the console in development
    if (process.env.NODE_ENV !== 'production' || payload.level === 'error') {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${payload.level.toUpperCase()}]`;
      
      switch (payload.level) {
        case 'error':
          console.error(prefix, payload.message, payload.metadata || '');
          break;
        case 'warn':
          console.warn(prefix, payload.message, payload.metadata || '');
          break;
        case 'debug':
          console.debug(prefix, payload.message, payload.metadata || '');
          break;
        default:
          console.log(prefix, payload.message, payload.metadata || '');
      }
    }

    // Try to send to our API route in the background
    try {
      // Fire and forget
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(err => {
        // Silently fail if the network request drops so we don't cause infinite loops
        console.error("Logger failed to reach API:", err);
      });
    } catch (e) {
      // Ignore
    }
  }

  info(message: string, metadata?: Record<string, any>) {
    this.sendLog({ level: 'info', message, metadata });
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.sendLog({ level: 'warn', message, metadata });
  }

  error(message: string, metadata?: Record<string, any>) {
    // Automatically extract Error objects into JSON-safe metadata
    if (metadata?.error instanceof Error) {
      metadata.error = {
        name: metadata.error.name,
        message: metadata.error.message,
        stack: metadata.error.stack,
      };
    }
    this.sendLog({ level: 'error', message, metadata });
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.sendLog({ level: 'debug', message, metadata });
  }
}

export const logger = new Logger();
