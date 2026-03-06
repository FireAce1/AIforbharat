import { createLogger } from '../../shared/utils/logger';
import { config } from '../config';

const logger = createLogger({
  service: 'auth-service',
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  nodeEnv: config.nodeEnv,
});

export default logger;
