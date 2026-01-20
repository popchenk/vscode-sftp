import * as vscode from 'vscode';
import { LogLevel } from '../types';

/**
 * Secure logger that NEVER logs sensitive data.
 * All credentials, passwords, and keys are automatically redacted.
 */
export class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel;

    // Patterns that indicate sensitive data
    private static readonly SENSITIVE_PATTERNS = [
        /password["\s:=]+[^"\s,}]+/gi,
        /passphrase["\s:=]+[^"\s,}]+/gi,
        /privateKey["\s:=]+[^"\s,}]+/gi,
        /secret["\s:=]+[^"\s,}]+/gi,
        /token["\s:=]+[^"\s,}]+/gi,
        /key["\s:=]+[^"\s,}]+/gi,
        /-----BEGIN[^-]+PRIVATE KEY-----[\s\S]*?-----END[^-]+PRIVATE KEY-----/gi,
    ];

    constructor(name: string, logLevel: LogLevel = 'info') {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.logLevel = logLevel;
    }

    /**
     * Set the log level.
     */
    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Log an error message.
     */
    public error(message: string, error?: Error): void {
        if (this.shouldLog('error')) {
            const sanitized = this.sanitize(message);
            const errorDetails = error ? this.sanitizeError(error) : '';
            this.outputChannel.appendLine(`[ERROR] ${sanitized}${errorDetails}`);
        }
    }

    /**
     * Log a warning message.
     */
    public warn(message: string): void {
        if (this.shouldLog('warn')) {
            const sanitized = this.sanitize(message);
            this.outputChannel.appendLine(`[WARN] ${sanitized}`);
        }
    }

    /**
     * Log an info message.
     */
    public info(message: string): void {
        if (this.shouldLog('info')) {
            const sanitized = this.sanitize(message);
            this.outputChannel.appendLine(`[INFO] ${sanitized}`);
        }
    }

    /**
     * Log a debug message.
     */
    public debug(message: string): void {
        if (this.shouldLog('debug')) {
            const sanitized = this.sanitize(message);
            this.outputChannel.appendLine(`[DEBUG] ${sanitized}`);
        }
    }

    /**
     * Show the output channel.
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose of the logger.
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }

    /**
     * Sanitize a message by removing sensitive data.
     */
    private sanitize(message: string): string {
        let sanitized = message;

        // Replace sensitive patterns with [REDACTED]
        for (const pattern of Logger.SENSITIVE_PATTERNS) {
            sanitized = sanitized.replace(pattern, (match) => {
                const key = match.split(/[:\s=]+/)[0];
                return `${key}: [REDACTED]`;
            });
        }

        return sanitized;
    }

    /**
     * Sanitize error objects.
     */
    private sanitizeError(error: Error): string {
        const message = error.message ? this.sanitize(error.message) : '';
        const stack = error.stack ? this.sanitize(error.stack) : '';

        let result = '';
        if (message) {
            result += `\n  Message: ${message}`;
        }
        if (stack && this.logLevel === 'debug') {
            result += `\n  Stack: ${stack}`;
        }

        return result;
    }

    /**
     * Check if a message should be logged based on current log level.
     */
    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);

        return messageLevelIndex <= currentLevelIndex;
    }

    /**
     * Sanitize an object for logging (removes sensitive fields).
     */
    public static sanitizeObject(obj: unknown): unknown {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => Logger.sanitizeObject(item));
        }

        const sanitized: Record<string, unknown> = {};
        const sensitiveKeys = [
            'password',
            'passphrase',
            'privateKey',
            'secret',
            'token',
            'key',
            'credentials',
        ];

        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
                // eslint-disable-next-line security/detect-object-injection
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                // eslint-disable-next-line security/detect-object-injection
                sanitized[key] = Logger.sanitizeObject(value);
            } else {
                // eslint-disable-next-line security/detect-object-injection
                sanitized[key] = value;
            }
        }

        return sanitized;
    }
}

// Global logger instance
let globalLogger: Logger | null = null;

/**
 * Get the global logger instance.
 */
export function getLogger(): Logger {
    if (!globalLogger) {
        globalLogger = new Logger('Secure SFTP');
    }
    return globalLogger;
}

/**
 * Initialize the global logger with a specific log level.
 */
export function initLogger(logLevel: LogLevel): Logger {
    if (globalLogger) {
        globalLogger.dispose();
    }
    globalLogger = new Logger('Secure SFTP', logLevel);
    return globalLogger;
}
