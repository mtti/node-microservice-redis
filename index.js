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

const _ = require('lodash');
const Redis = require('ioredis');

module.exports = {
  configure: (config) => {
    config.redisOptions = config.redisOptions || {};

    if (process.env.REDIS_SERVER) {
      const parts = process.env.REDIS_SERVER.split(':');
      config.redisOptions.host = parts[0];
      config.redisOptions.port = parts[1];
    }

    const redisOptions = {};
    if (config.name) {
      redisOptions.keyPrefox = `${config.name}:`;
    }
    _.merge(redisOptions, config.redisOptions);

    config.redisOptions = redisOptions;
  },

  init: (service) => {
    service.redis = new Redis(service.config.redisOptions);

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
