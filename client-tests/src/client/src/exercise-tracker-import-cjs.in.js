const {createRoliClient, Exercise, ExerciseAdded, ExerciseTrackerEndpoint, User} = require("exercise-tracker-service");
const {ServiceOptions, createUuid} = require("roli-client");
const {test, run, barrierWait, setLogPrefix, getLogPrefix} = require("./shared-runner.js");
const {assert} = require("./assert.js");