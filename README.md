# @tummycrypt/tinyland-security

IP hashing, encryption, risk scoring, device and VPN detection, rate limiting
(with a shared-store seam for multi-replica deploys), security headers,
timing-safe utilities, a flat-file IP ban store and threat correlation.

## Consuming it (Bazel only)

This package is distributed only as a Bazel module from the xoxd-ai
bazel-registry (RU6/RU8). It is not published to npmjs or GitHub Packages;
the old 0.x npm versions are frozen.

```starlark
# .bazelrc
common --registry=https://raw.githubusercontent.com/xoxd-ai/bazel-registry/main
common --registry=https://bcr.bazel.build

# MODULE.bazel
bazel_dep(name = "tummycrypt_tinyland_security", version = "1.1.1")
```

```starlark
# BUILD.bazel (rules_js)
load("@aspect_rules_js//npm:defs.bzl", "npm_link_package")

npm_link_package(
    name = "node_modules/@tummycrypt/tinyland-security",
    src = "@tummycrypt_tinyland_security//:pkg",
)
```

Toolchain: TypeScript 7.0.2, Vite 8.3.3 and vitest 5.0.3 (exact pins, RU1/RU5),
Node >= 22.12.

## Exports

| Import | Contents |
|---|---|
| `@tummycrypt/tinyland-security` | IP hashing and encryption, risk scoring, device/VPN detection, `RateLimiter` with `IRateLimitStore` / `SharedRateLimitStore`, security headers, timing-safe helpers, the legacy ban store (`configureIpBanStore`) |
| `@tummycrypt/tinyland-security/ip-bans` | Flat-file IP ban store, formerly `@tummycrypt/tinyland-ip-bans` |
| `@tummycrypt/tinyland-security/threat-detection` | Threat correlation and security data queries, formerly `@tummycrypt/tinyland-threat-detection` |

`@maxmind/geoip2-node` (>= 5) is an optional peer for GeoIP lookups.

Migration notes for each release, including from the retired ip-bans and
threat-detection modules, are in [CHANGELOG.md](CHANGELOG.md).

## Development

Bazel is the authority for build, typecheck and tests:

```sh
bazel build //:pkg //:typecheck
bazel test //...
```

`pnpm install --frozen-lockfile` followed by `pnpm typecheck` / `pnpm test`
works for local diagnostics (pnpm 10.13.1).

## License

Zlib AND LicenseRef-Tinyland-Proprietary. See [LICENSE](LICENSE).
