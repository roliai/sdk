#!/usr/bin/env bash
set -ex
cd $(dirname ${0})

# Exercise Tracker Tests
TEST="exercise-tracker"
./.compile.sh ${TEST} cjs shared false
./.run-shared.sh ${TEST} cjs 2

./.compile.sh ${TEST} esm shared false
./.run-shared.sh ${TEST} esm 2