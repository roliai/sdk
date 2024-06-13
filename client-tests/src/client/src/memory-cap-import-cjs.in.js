const {createRoliClient, MemoryCapEndpoint, ServiceOptions, PlatformError} = require("memory-cap-service");
const t = require("./single-runner.js");
const {test, run, setLogPrefix, getLogPrefix} = t;
const a = require("./assert.js");
const {assert} = a;
