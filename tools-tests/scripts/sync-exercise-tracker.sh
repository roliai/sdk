#!/usr/bin/env bash
set -ex
cd $(dirname "${0}")
cd ..

# Copy the example's service code and use that as a test service backend
rm -rf "${ROLI_CLIENT_TESTS_DIR}/src/services/exercise-tracker"
cp -rv "${ROLI_EXERCISE_TRACKER_DIR}/service" "${ROLI_CLIENT_TESTS_DIR}/src/services/exercise-tracker" > /dev/null