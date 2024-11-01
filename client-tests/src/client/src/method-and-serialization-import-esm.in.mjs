import {createRoliClient, Metadata, ExampleEndpoint, ExampleSession, OtherEndpoint, OtherSession, SessionHarness, createUuid, ServiceOptions} from "method-and-serialization-service";
import * as t from "./single-runner.js";
const {test, run, setLogPrefix, getLogPrefix} = t;
import * as a from "./assert.js";
const {assert} = a;
import {key} from "method-and-serialization-service/key";
