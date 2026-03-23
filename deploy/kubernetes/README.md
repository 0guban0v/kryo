# Kubernetes Deployment Notes

These manifests are a starter deployment example for the `mcp` service.

They intentionally assume:

- the images are built and pushed separately
- Fizzy and the configured git forge are reachable through URLs supplied in config
- the Infisical operator is installed in the cluster before you apply the `InfisicalSecret` resource

The `mcp-config` ConfigMap ships placeholder service URLs such as
`http://fizzy.replace-me.svc.cluster.local`. Replace them for each environment instead of assuming
Fizzy or your git forge run in a specific namespace.

Concrete secret flow in this directory:

1. Install the Infisical operator in the target cluster.
2. Apply `mcp-serviceaccount.yaml`.
3. Edit `mcp-infisical-secret.yaml` with the real Infisical API host, machine identity, project, environment, and secret path.
4. Apply the kustomization. The operator will sync a native Kubernetes Secret named `secrets-vault`.
5. The `mcp` deployment consumes that synced secret through `envFrom`.

The bundled example uses Infisical Kubernetes Auth via a dedicated workload service account so the app deployment itself stays environment-agnostic.

Recommended production defaults:

- use self-hosted Infisical as the source of truth
- prefer `MCP_HTTP_SESSION_MODE=stateless` for non-sticky or multi-replica HTTP deployments
- keep TLS termination and external auth at the ingress or gateway layer
- keep the application manifests stable across environments and only vary config, identities, and image tags

The manifests do not include an ingress so the TLS boundary stays explicit and environment-specific.
