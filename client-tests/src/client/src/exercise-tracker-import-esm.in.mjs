import {createRoliClient, Exercise, ExerciseAdded, ExerciseTrackerEndpoint, User, ServiceOptions, createUuid} from "exercise-tracker-service";
import * as t from "./shared-runner.js";
const {test, run, barrierWait, setLogPrefix, getLogPrefix} = t;
import * as a from "./assert.js";
const {assert} = a;
import {key} from "exercise-tracker-service/key";