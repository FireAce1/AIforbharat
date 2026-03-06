import { createLogger } from '../../shared/utils/logger';
import { config } from '../config';

export const logger = createLogger({
  service: 'market-service',
  level: config.logging.level,
  nodeEnv: config.nodeEnv,
});
