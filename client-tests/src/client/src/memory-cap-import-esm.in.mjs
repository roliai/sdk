import {createRoliClient, MemoryCapEndpoint, ServiceOptions, PlatformError} from "memory-cap-service";
import * as t from "./single-runner.js";
const {test, run, setLogPrefix, getLogPrefix} = t;
import * as a from "./assert.js";
const {assert} = a;
import {key} from "memory-cap-service/key";