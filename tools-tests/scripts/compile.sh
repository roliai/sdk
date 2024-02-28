#!/usr/bin/env bash
set -ex
cd $(dirname "${0}")

cd ..

scripts/sync-exercise-tracker.sh
scripts/sync-doctorsnotes.sh
scripts/sync-method-and-serialization.sh

rm -rf dist
./node_modules/.bin/tsc