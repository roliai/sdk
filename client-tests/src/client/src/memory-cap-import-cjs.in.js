const {createRoliClient, MemoryCapEndpoint} = require("memory-cap-service");
const {ServiceOptions, PlatformError} = require("roli-client");
const t = require("./single-runner.js");
const {test, run, setLogPrefix, getLogPrefix} = t;
const a = require("./assert.js");
const {assert} = a;
