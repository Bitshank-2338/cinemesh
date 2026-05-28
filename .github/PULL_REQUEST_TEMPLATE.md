## What does this PR do?

Brief description of the change and the *why* behind it.

Closes #(issue number)

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Docs / chore

## How was this tested?

Describe what you did to verify. For WebRTC/media changes, confirm you tested:

- [ ] 2 peers
- [ ] 8+ peers (mesh strain point)
- [ ] camera off / mic off / screen share simultaneously
- [ ] rapid mic toggling (no one disconnects)
- [ ] a peer joining mid-screen-share

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] No secrets added with a `NEXT_PUBLIC_` prefix
- [ ] No DRM-circumvention code
- [ ] Updated CHANGELOG.md if user-facing
