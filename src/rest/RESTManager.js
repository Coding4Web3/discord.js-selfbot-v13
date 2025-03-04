'use strict';

const { setInterval } = require('node:timers');
const { Collection } = require('@discordjs/collection');
const APIRequest = require('./APIRequest');
const routeBuilder = require('./APIRouter');
const CaptchaSolver = require('./CaptchaSolver');
const RequestHandler = require('./RequestHandler');
const { Error } = require('../errors');
const { Endpoints } = require('../util/Constants');

class RESTManager {
  constructor(client) {
    this.client = client;
    this.handlers = new Collection();
    this.versioned = true;
    this.globalLimit = client.options.restGlobalRateLimit > 0 ? client.options.restGlobalRateLimit : Infinity;
    this.globalRemaining = this.globalLimit;
    this.globalReset = null;
    this.globalDelay = null;
    if (client.options.restSweepInterval > 0) {
      this.sweepInterval = setInterval(() => {
        this.handlers.sweep(handler => handler._inactive);
      }, client.options.restSweepInterval * 1_000).unref();
    }
    this.captchaService = null;
    this.setup();
  }

  setup() {
    this.captchaService = new CaptchaSolver(
      this.client.options.captchaService,
      this.client.options.captchaKey,
      this.client.options.captchaSolver,
    );
  }

  get api() {
    return routeBuilder(this);
  }

  getAuth() {
    if ((this.client.token && this.client.user && this.client.user.bot) || this.client.accessToken) {
      return `Bot ${this.client.token}`;
    } else if (this.client.token) {
      return this.client.token;
    }
    /*
    // v13.7
    const token = this.client.token ?? this.client.accessToken;
    if (token) return `Bot ${token}`;
     */
    throw new Error('TOKEN_MISSING');
  }

  get cdn() {
    return Endpoints.CDN(this.client.options.http.cdn);
  }

  request(method, url, options = {}) {
    const apiRequest = new APIRequest(this, method, url, options);
    let handler = this.handlers.get(apiRequest.route);

    if (!handler) {
      handler = new RequestHandler(this);
      this.handlers.set(apiRequest.route, handler);
    }

    return handler.push(apiRequest);
  }

  get endpoint() {
    return this.client.options.http.api;
  }

  set endpoint(endpoint) {
    this.client.options.http.api = endpoint;
  }
}

module.exports = RESTManager;
