#!/usr/bin/env bash
# "CI passed" (.github/workflows/ci.yml): reads the results of the jobs it needs from
# RESULTS_OF_THE_JOBS ("success failure skipped …", one word per job) and fails unless
# every one is "success". A job that failed, was cancelled or was skipped makes it fail, and
# so does an empty list: no results means nothing was checked. A script of its own, so
# ci.yml runs one command that verifyMatchesCi.test.ts can compare exactly.
set -u

results="${RESULTS_OF_THE_JOBS:-}"
echo "Results of the jobs: ${results:-(none)}"
if [ -z "$results" ]; then
  echo "No job results were given, so CI did not pass."
  exit 1
fi
for result in $results; do
  if [ "$result" != "success" ]; then
    echo "A job ended as \"$result\", so CI did not pass."
    exit 1
  fi
done
echo "Every job passed."
