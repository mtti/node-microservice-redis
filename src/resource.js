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

    if (options.logger) {
      this._logger = options.logger;
    }

    this._defaultBodySchema = options.defaultBodySchema;
    this._jsonValidation = options.jsonValidation || 'permissive';
    this._jsonSchemas = options.jsonSchemas || {};
    this._actions = [];

    if (options.defaultActions !== false) {
      if (this._jsonValidation === 'strict' && !this._defaultBodySchema) {
        throw new Error('defaultBodySchema is required with defaultActions and strict validation');
      }

      const getAction = new InstanceAction('GET', this._get.bind(this));
      const putAction = new InstanceAction('PUT', this._put.bind(this))
        .setLoadInstance(false)
        .setBodySchema(this._defaultBodySchema);
      const patchAction = new InstanceAction('PATCH', this._patch.bind(this))
        .setBodySchema(this._defaultBodySchema);
      const deleteAction = new InstanceAction('DELETE', this._delete.bind(this))
        .setLoadInstance(false);

      Array.prototype.push.apply(this._actions, [
        getAction,
        putAction,
        patchAction,
        deleteAction,
      ]);
    }

    if (options.actions) {
      Array.prototype.push.apply(this._actions, this._model.actions);
    }
  }

  start() {
    const serverOptions = {
      instanceLoader: this._instanceLoader.bind(this),
      jsonValidation: this._jsonValidation,
      jsonSchemas: this._jsonSchemas,
      actions: this._actions,
      logger: this._logger,
    };
    this._server = new ResourceServer(
      this._natsClient,
      this._name,
      serverOptions
    );
    this._server.start();
  }

  _getKey(id) {
    return `${this._name}:${id}`;
  }

  _instanceLoader(id) {
    if (!id) {
      return Promise.resolve(null);
    }
    return this._redisClient.get(this._getKey(id))
      .then((rawBody) => {
        if (!rawBody) {
          throw createError(404);
        }
        return JSON.parse(rawBody);
      });
  }

  _stringifyAndSet(id, body) {
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

  _get(instance) {
    return instance;
  }

  _put(id, body) {
    if (!body) {
      return Promise.reject(createError(400));
    }
    return this._stringifyAndSet(id, body);
  }

  _patch(instance, changes) {
    if (!changes) {
      return Promise.reject(createError(400));
    }

    _.merge(instance, changes);

    return this._stringifyAndSet(instance.id, body);
  }

  _delete(id) {
    return this._redisClient.del(this._getKey(id))
      .then(() => ({ result: 'OK' }));
  }
}

module.exports = RedisResource;
