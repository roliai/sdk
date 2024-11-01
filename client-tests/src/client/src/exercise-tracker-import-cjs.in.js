const {createRoliClient, Exercise, ExerciseAdded, ExerciseTrackerEndpoint, User, ServiceOptions, createUuid} = require("exercise-tracker-service");
const {test, run, barrierWait, setLogPrefix, getLogPrefix} = require("./shared-runner.js");
const {assert} = require("./assert.js");
const {key} = require("exercise-tracker-service/key");