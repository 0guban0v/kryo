# Compose Deployment Notes

The root [`docker-compose.yml`](../../docker-compose.yml) is the primary local deployment entry point.

This folder exists so environment-specific compose overlays or cloud-adjacent compose examples can be added later without mixing them into the root developer workflow.

Current rule:

- keep the root compose file optimized for a disposable local stack
- keep secrets outside checked-in compose files
- prefer Infisical-based runtime secret delivery for anything beyond local bootstrap
