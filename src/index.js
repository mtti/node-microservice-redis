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

const connection = require('./connection');
const RedisResource = require('./resource');

function plugin(models) {
  return {
    configure(config) {
      connection.configure(config);
    },
    init(service) {
      connection.init(service);
      if (models) {
        const resourcePlugin = RedisResource.plugin(models);
        resourcePlugin.init(service);
      }
    }
  };
}

plugin.RedisResource = RedisResource;

module.exports = plugin;
