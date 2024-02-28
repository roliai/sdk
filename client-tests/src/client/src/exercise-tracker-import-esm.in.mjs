import {createRoliClient, Exercise, ExerciseAdded, ExerciseTrackerEndpoint, User} from "exercise-tracker-service";
import {ServiceOptions, createUuid} from "roli-client";
import * as t from "./shared-runner.js";
const {test, run, barrierWait, setLogPrefix, getLogPrefix} = t;
import * as a from "./assert.js";
const {assert} = a;