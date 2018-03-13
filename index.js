/*
Copyright 2018 Matti Hiltunen

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const Redis = require('ioredis');

module.exports = {
  configure: (config) => {
    config.redisMode = config.redisMode || 'standard';

    if (config.redisMode === 'standard') {
      if (config.redisOptions) {
        return;
      }

      if (config.redisServer) {
        return;
      }

      if (process.env.REDIS_SERVER) {
        config.dbServer = process.env.REDIS_SERVER;
      } else {
        throw new Error(
          'Either config.redisOptions, config.redisServer or REDIS_SERVER is required');
      }
    } else if (config.redisMode === 'cluster') {
      if (!config.redisNodes || !config.redisClusterOptions) {
        throw new Error('config.redisNodes and config.redisClusterOptions are required');
      }
    } else {
      throw new Error(`Unsupported Redis mode: ${config.redisMode}`);
    }
  },

  init: (service) => {
    if (service.config.redisMode === 'standard') {
      if (service.config.redisOptions) {
        service.redis = new Redis(service.config.redisOptions);
      } else if (service.config.redisServer) {
        service.redis = new Redis(service.config.redisServer);
      } else {
        throw new Error('Either config.redisOptions or config.redisServer is required');
      }
    } else if (service.config.redisMode === 'cluster') {
      service.redis = new Redis.Cluster(config.redisNodes, config.redisClusterOptions);
    }

    let connected = false;

    return new Promise((resolve) => {
      service.redis.on('connect', () => service.logger.info('Redis connect'));
      service.redis.on('reconnecting', () => service.logger.info('Redis reconnecting'));
      service.redis.on('error', (error) => service.logger.error(`Redis error: ${error}`));
      service.redis.on('end', () => service.logger.info('Redis end'));
      service.redis.on('warning', () => service.logger.info('Redis warning'));
      service.redis.on('ready', () => {
        service.logger.info('Redis ready');
        if (!connected) {
          connected = true;
          resolve();
        }
      });
    });
  }
}
