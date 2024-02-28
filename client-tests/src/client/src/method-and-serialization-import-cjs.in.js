const {createRoliClient, Metadata, ExampleEndpoint, ExampleSession, OtherEndpoint, OtherSession, SessionHarness} = require("method-and-serialization-service");
const {createUuid, ServiceOptions} = require("roli-client");
const t = require("./single-runner.js");
const {test, run, setLogPrefix, getLogPrefix} = t;
const a = require("./assert.js");
const {assert} = a;
