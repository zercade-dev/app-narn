SHELL := /bin/bash
.PHONY: verify start-secure smoke-secure security-check sync-glossaries bump-version release-prep

## Launch the API under Node's experimental permission model
start-secure:
	pnpm --filter @zercade-dev/narn-server start:secure

## Boot the built server under the permission model and verify its read/write
## paths still fit the --allow-fs-* allow-lists (requires a prior `pnpm build`)
smoke-secure:
	./scripts/smoke-secure.sh

## Run security audit to check for vulnerabilities
security-check:
	pnpm audit --json > audit-report.json || true
	@echo "Checking for high/critical vulnerabilities in production dependencies..."
	@node -e "const fs = require('fs'); const r = JSON.parse(fs.readFileSync('./audit-report.json', 'utf-8')); const prodHigh = Object.values(r.advisories).filter(a => a.severity === 'high' && !a.findings.every(f => f.dev)).length; const prodCritical = Object.values(r.advisories).filter(a => a.severity === 'critical' && !a.findings.every(f => f.dev)).length; if (prodHigh > 0 || prodCritical > 0) { console.error('High or critical severity vulnerabilities found in production dependencies!'); process.exit(1); }"

## Release gate for the public app: build + lint + format + locale checks +
## prod security audit. check:locales is here because CI's quality-gate job
## runs it and .githooks/pre-push runs this target — without it a push passes
## locally and fails in CI. check:lexicon is the same story for the
## terminology lexicon: it proves every rendering quoted in
## docs/i18n/terminology/<locale>.md actually occurs in the shipped locale
## files. (lint:deps stays out; CI runs it separately.)
verify:
	pnpm build
	pnpm lint
	pnpm format:check
	pnpm check:locales
	pnpm check:lexicon
	$(MAKE) security-check

## Refresh the bundled global glossaries from the public community
## translation sheet (dev-time: changes ship via the normal build/publish
## pipeline). Preview with FLAGS=--dry-run.
sync-glossaries:
	pnpm exec tsx scripts/sync-global-glossaries.ts $(FLAGS)

## Bump the app version and refresh scraped pricing/capability/context data in
## one step. Usage: make bump-version VERSION=1.10.3
## Prefer `make release-prep` when cutting a release — it also consolidates the
## unreleased changelog fragments into the version entry the release notes read.
bump-version:
	@test -n "$(VERSION)" || (echo "Usage: make bump-version VERSION=x.y.z" && exit 1)
	npm version $(VERSION) --no-git-tag-version --allow-same-version
	pnpm exec tsx scripts/update-provider-pricing.ts
	@echo "Version bumped to $(VERSION). Still needed:"
	@echo "  - packages/frontend/src/guides/en/changelog/v$(VERSION).md"
	@echo "  - commit both"

## Prepare a release ON DEVELOP: consolidate the unreleased changelog fragments
## into v$(VERSION).md, bump the version, and refresh the bundled pricing snapshot
## so it is not stale at release time. Commit the result, then merge develop -> main;
## that merge promotes the smoked image, cuts vX.Y.Z, and publishes the release
## notes from the file this writes. Usage: make release-prep VERSION=1.60.0
release-prep:
	@test -n "$(VERSION)" || (echo "Usage: make release-prep VERSION=x.y.z" && exit 1)
	node scripts/release-prep.mjs $(VERSION)
	pnpm exec tsx scripts/update-provider-pricing.ts
	@echo ""
	@echo "Next: review the diff, commit, then merge develop -> main."
