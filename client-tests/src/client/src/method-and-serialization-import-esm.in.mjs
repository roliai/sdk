import {createRoliClient, Metadata, ExampleEndpoint, ExampleSession, OtherEndpoint, OtherSession, SessionHarness} from "method-and-serialization-service";
import {createUuid, ServiceOptions} from "roli-client";
import * as t from "./single-runner.js";
const {test, run, setLogPrefix, getLogPrefix} = t;
import * as a from "./assert.js";
const {assert} = a;
