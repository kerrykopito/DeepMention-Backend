#!/bin/sh
# One image serves every background process; WORKER_KIND picks which one.
# Cloud Run sets this per service, so the same build is deployed several times.
set -e

case "${WORKER_KIND:-scrape}" in
  scrape)      exec npm run worker:scrape ;;
  sources)     exec npm run worker:sources ;;
  weekly)      exec npm run scheduler:weekly-email ;;
  # One-shot send for a Cloud Run Job driven by Cloud Scheduler, rather than
  # a node-cron process idling all week waiting for Monday.
  weekly-once) exec npm run weekly-email:send ;;
  *)
    echo "Unknown WORKER_KIND: ${WORKER_KIND}. Expected: scrape, sources, weekly, weekly-once." >&2
    exit 1
    ;;
esac
