# Kubernetes Deployment Notes

These manifests are a starter deployment example for the `mission-control-mcp` service and the `sample-service`.

They intentionally assume:

- the images are built and pushed separately
- Fizzy, Campfire, and the configured git forge are reachable through URLs supplied in config
- `mission-control-mcp-secrets` is populated out-of-band, ideally by a self-hosted Infisical integration

The `mission-control-mcp-config` ConfigMap ships placeholder service URLs such as
`http://fizzy.replace-me.svc.cluster.local`. Replace them for each environment instead of assuming
Fizzy or Campfire run in a specific namespace.

Recommended secret flow:

- use self-hosted Infisical as the source of truth
- sync or inject the secret material into the cluster
- keep the application manifests stable across environments

The manifests do not include an ingress so the TLS boundary stays explicit and environment-specific.
