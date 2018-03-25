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
const createError = require('http-errors');
const { ResourceServer, InstanceAction } = require('@mtti/nats-rest');

class RedisResource {
  /**
   * Return a @mtti/microservice plugin which creates and starts a RedisResource for every
   * option object given as the parameter.
   * @param {Object|Object[]} model
   */
  static plugin(model) {
    let models;
    if (Array.isArray(model)) {
      models = model;
    } else {
      models = [ model ];
    }
    return {
      init(service) {
        service.redisResources = models.map((model) => {
          const options = {
            logger: service.logger,
          };
          _.merge(options, model);

          const resource = new RedisResource(
            service.natsClient,
            service.redisClient,
            options,
          );
          return resource;
        });
        service.redisResources.forEach(resource => resource.start());
      }
    }
  }

  constructor(natsClient, redisClient, options = {}) {
    this._natsClient = natsClient;
    this._redisClient = redisClient;
    this._name = options.name;
    this._expire = options.expire || 0;
    this._logger = options.logger;

    this._schemaRef = options.schemaRef;
    this._jsonSchemas = options.jsonSchemas || [];
    this._actions = [];

    if (options.actions) {
      Array.prototype.push.apply(this._actions, this._model.actions);
    }
  }

  start() {
    const adapter = {
      load: this._load.bind(this),
      toJSON: this._toJSON.bind(this),
      upsert: this._upsert.bind(this),
      delete: this._delete.bind(this),
    };

    const serverOptions = {
      adapter,
      jsonSchemas: this._jsonSchemas,
      schemaRef: this._schemaRef,
      actions: this._actions,
      logger: this._logger,
    };
    this._server = new ResourceServer(this._natsClient, this._name, serverOptions);
    this._server.start();
  }

  _load(id) {
    return this._redisClient.get(this._getKey(id))
      .then((rawBody) => {
        if (!rawBody) {
          return null;
        }
        return JSON.parse(rawBody);
      });
  }

  _toJSON(instance) {
    return instance;
  }

  _upsert(id, body) {
    const bodyCopy = _.cloneDeep(body);

    if (id) {
      bodyCopy.id = id;
    }

    const key = this._getKey(id);
    const rawBody = JSON.stringify(bodyCopy);

    let promise;
    if (this._expire) {
      promise = this._redisClient.set(key, rawBody, 'ex', this._expire);
    } else {
      promise = this._redisClient.set(key, rawBody);
    }
    return promise
      .then(() => this._server.emit(bodyCopy))
      .then(() => bodyCopy);
  }

  _delete(id) {
    return this._redisClient.del(this._getKey(id));
  }

  _getKey(id) {
    return `${this._name}:${id}`;
  }
}

module.exports = RedisResource;
