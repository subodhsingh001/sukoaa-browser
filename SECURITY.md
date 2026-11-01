# Security maintenance process

This is a preview candidate, not an independently audited browser. No automatic binary updater is implemented. Filters do not patch Electron, Chromium, GeckoView or Android WebView. Public launch is blocked until the release owner supplies contact, supported platforms and verified update/distribution channels.

## Maintainer procedure

Check Electron's supported stable releases/security advisories and Mozilla GeckoView releases at least weekly and immediately on a relevant advisory. Dependabot is configured for npm/Gradle and GitHub Actions; it becomes active only after committing this repository to GitHub with Dependabot enabled. Never merge a dependency bump solely because it compiles. Upgrade the pinned engine/dependencies and lockfiles, regenerate inventories/source archives, run the native regressions plus physical-device matrix, then release signed packages and corresponding source together. Address critical exploited engine issues urgently; if a safe build cannot be provided, withdraw affected downloads and tell users to use an updated mainstream browser. This is an operational procedure, not a promise of an existing 24/7 response team.

Release branches must retain sandbox, context isolation, certificate checks and private extension exclusion. Do not replace trust checks with --no-sandbox or disable Play Protect/SmartScreen to make a release appear trusted. Code-sign only after all branding/resource edits. Verify signatures and payload hashes before publishing. Android Next's existing preview identity is preserved for upgrades; it is not a verified public publisher identity. A Play release needs an owner-approved signing plan before enrollment, not an unexplained new key.

Use the release gate before any public upload. Publish hashes, signing identity/fingerprint, versions, source access and tested OS/device matrix with release notes. Roll back by withdrawing a bad download and publishing a correctly signed higher-version fix; don't direct Android users to downgrade a package that would be rejected.

Public vulnerability-report contact and security policy URL: NOT CONFIGURED. Do not send reports to invented addresses. Keep a private report channel ready before launch. No public beta is authorized by the automated gate until this is resolved.
