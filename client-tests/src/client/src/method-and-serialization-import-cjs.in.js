const {createRoliClient, Metadata, ExampleEndpoint, ExampleSession, OtherEndpoint, OtherSession, SessionHarness, createUuid, ServiceOptions} = require("method-and-serialization-service");
const t = require("./single-runner.js");
const {test, run, setLogPrefix, getLogPrefix} = t;
const a = require("./assert.js");
const {assert} = a;
const {key} = require("method-and-serialization-service/key");