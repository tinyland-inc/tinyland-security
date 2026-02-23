






















import type { SecurityConfig, SecurityLogger } from './types.js';





const consoleLogger: SecurityLogger = {
	info(message: string, data?: Record<string, unknown>) {
		console.log(`[security:info] ${message}`, data ?? '');
	},
	warn(message: string, data?: Record<string, unknown>) {
		console.warn(`[security:warn] ${message}`, data ?? '');
	},
	error(message: string, data?: Record<string, unknown>) {
		console.error(`[security:error] ${message}`, data ?? '');
	},
	debug(message: string, data?: Record<string, unknown>) {
		if (process.env.NODE_ENV === 'development') {
			console.debug(`[security:debug] ${message}`, data ?? '');
		}
	},
};





let _config: SecurityConfig = {};
let _logger: SecurityLogger = consoleLogger;









export function configureSecurity(options: {
	config?: SecurityConfig;
	logger?: SecurityLogger;
}): void {
	if (options.config) {
		_config = { ..._config, ...options.config };
	}
	if (options.logger) {
		_logger = options.logger;
	}
}





export function getSecurityConfig(): SecurityConfig {
	return _config;
}





export function getLogger(): SecurityLogger {
	return _logger;
}





export function resetSecurityConfig(): void {
	_config = {};
	_logger = consoleLogger;
}
