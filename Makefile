SHELL := /bin/bash
.PHONY: verify start-secure smoke-secure security-check sync-glossaries bump-version release-prep freeway-refresh

## Launch the API under Node's experimental permission model
start-secure:
	pnpm --filter @zercade-dev/narn-server start:secure

## Boot the built server under the permission model and verify its read/write
## paths still fit the --allow-fs-* allow-lists (requires a prior `pnpm build`)
smoke-secure:
	./scripts/smoke-secure.sh

## Run security audit to check for vulnerabilities. Verbatim the gating step in
## .github/workflows/security.yml, scope included: a failure here has to mean what a
## failure there means. Build-chain advisories gate too — that chain produces the
## published image, and its patched ranges live in pnpm-workspace.yaml's `overrides:`.
security-check:
	pnpm audit --audit-level=high

## Release gate for the public app: build + lint + format + locale checks +
## dependency security audit. check:locales and check:lexicon are both here because
## CI's quality-gate job runs each of them directly too (see
## .github/workflows/ci.yml) and .githooks/pre-push runs this target —
## without them here, a push passes locally and fails in CI. check:lexicon
## proves every rendering quoted in docs/i18n/terminology/<locale>.md
## actually occurs in the shipped locale files. (lint:deps stays out; CI
## runs it separately.)
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

## Check the bundled Freeway free-tier snapshot against the live providers. Report
## only unless asked: FLAGS=--probe-candidates, --write-suggestion <path>, --apply-retired.
## Makes real calls, one request of free quota per model.
freeway-refresh:
	pnpm exec tsx scripts/freeway-refresh.ts $(FLAGS)

## Refresh the pricing snapshot, or stop with recovery steps. Runs before anything else
## in the targets below, so a stop leaves the version and fragments untouched and the
## same command can simply be run again. Accepted providers stay written in the working
## tree. SKIP_PRICING=1 deliberately keeps the existing prices.
define refresh_pricing
@if [ "$(SKIP_PRICING)" = "1" ]; then \
	echo "SKIP_PRICING=1: not refreshing the pricing snapshot."; \
elif ! pnpm exec tsx scripts/update-provider-pricing.ts; then \
	echo ""; \
	echo "$@ STOPPED: the pricing refresh failed or rejected a provider (summary above)."; \
	echo "Rejected providers kept their existing prices; accepted ones are written in the working tree."; \
	echo "The version and changelog fragments are untouched."; \
	echo "The release can proceed only by a deliberate choice:"; \
	echo "  - fix the scraper, then rerun: make $@ VERSION=$(VERSION)"; \
	echo "  - or keep the existing prices: make $@ VERSION=$(VERSION) SKIP_PRICING=1"; \
	exit 1; \
fi
endef

## Refresh scraped pricing/capability/context data and bump the app version in one
## step. Usage: make bump-version VERSION=1.10.3 [SKIP_PRICING=1]
## Prefer `make release-prep` when cutting a release — it also consolidates the
## unreleased changelog fragments into the version entry the release notes read.
bump-version:
	@test -n "$(VERSION)" || (echo "Usage: make bump-version VERSION=x.y.z" && exit 1)
	$(refresh_pricing)
	npm version $(VERSION) --no-git-tag-version --allow-same-version
	@echo "Version bumped to $(VERSION). Still needed:"
	@echo "  - packages/frontend/src/guides/en/changelog/v$(VERSION).md"
	@echo "  - commit both"

## Prepare a release ON DEVELOP: refresh the bundled pricing snapshot so it is not
## stale at release time, then consolidate the unreleased changelog fragments into
## v$(VERSION).md and bump the version. Commit the result, then merge develop -> main;
## that merge promotes the smoked image, cuts vX.Y.Z, and publishes the release notes
## from the file this writes. Usage: make release-prep VERSION=1.60.0
## The refresh runs first because consolidation deletes the fragments; see
## refresh_pricing above for what a stop leaves behind and for SKIP_PRICING=1:
## make release-prep VERSION=1.60.0 SKIP_PRICING=1
release-prep:
	@test -n "$(VERSION)" || (echo "Usage: make release-prep VERSION=x.y.z" && exit 1)
	$(refresh_pricing)
	node scripts/release-prep.mjs $(VERSION)
	@echo ""
	@echo "Next: review the diff, commit, then merge develop -> main."
