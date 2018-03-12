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

const redis = require('redis');

module.exports = {
  configure: (config) => {
    if (config.redisServer) {
      return;
    }
    if (process.env.REDIS_SERVER) {
      config.dbServer = process.env.REDIS_SERVER;
    } else {
      throw new Error(
        'Either config.redisServer or REDIS_SERVER environment variable is required');
    }
  },

  init: (service) => {
    const redisClient = redis.createClient(service.config.redisServer);

    redisClient.on('ready', () => service.logger.info('Redis ready'));
    redisClient.on('connect', () => service.logger.info('Redis connect'));
    redisClient.on('reconnecting', () => service.logger.info('Redis reconnecting'));
    redisClient.on('error', (error) => service.logger.error(`Redis error: ${error}`));
    redisClient.on('end', () => service.logger.info('Redis end'));
    redisClient.on('warning', () => service.logger.info('Redis warning'));

    service.redis = redisClient;
  }
}
