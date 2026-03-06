import { createLogger } from '../../shared/utils/logger';
import { config } from '../config';

const logger = createLogger({
  service: 'climate-service',
  level: config.logging.level,
  nodeEnv: config.server.env,
});

export default logger;
