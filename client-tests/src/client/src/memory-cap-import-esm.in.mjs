import {createRoliClient, MemoryCapEndpoint} from "memory-cap-service";
import {ServiceOptions, PlatformError} from "roli-client";
import * as t from "./single-runner.js";
const {test, run, setLogPrefix, getLogPrefix} = t;
import * as a from "./assert.js";
const {assert} = a;
