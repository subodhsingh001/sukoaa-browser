# Review brief for the release owner and qualified adviser

Project: Sukoaa Browser 0.9.0. Declared original-application license: GPL-3.0-or-later. Desktop embeds Electron/Chromium; Android uses system WebView and redistributes GeckoView plus its resolved dependencies. No review item below has been marked approved by this audit.

## Questions to resolve

1. Confirm the GPL treatment of the original application plus the actual uBlock-derived scriptlet integration. Identify the exact preferred source, generator/conversion steps and what needs to accompany each binary.
2. Confirm each engine/component's source, attribution and redistribution obligations for Windows, Linux and Android separately. Are exact engine source locators sufficient for a given component, or must additional source/build materials be retained and delivered?
3. Review the actual Android Google Play services modules, whose POMs declare Android SDK terms, in the context of this GPL-covered combination. Identify applicable redistribution permission, any compatibility restriction, and any necessary engineering alternative. Do not infer an exception from this brief.
4. Review the EasyList CC-BY-SA choice, extraction attribution and data share-alike scope, together with the separately GPL-covered resources.
5. Clear the product name/logo and ensure compatibility references do not imply Google, Mozilla, Brave or upstream authors endorse Sukoaa.
6. Approve accurate publisher/privacy/source contacts and the actual distribution method. Review any codec/patent/export or store-policy issues relevant to the markets and binaries actually shipped.

## Evidence supplied

- LICENSE, LICENSE-SCOPE.md, THIRD-PARTY-NOTICES.md and SOURCE-ACCESS.txt.
- compliance/npm-source-records.json, sources/ archives, upstream/source-retrieval.json, current-review.json.
- compliance/android-runtime.json, android-license-metadata.json and android-poms/.
- compliance/chromium-components.json, dependencies.json and the explicitly partial npm SBOM.
- shared/filter-provenance.json and compliance/upstream/evidence.json.
- release/readiness.json and existing signing/device/update documentation.

The 52 POMs are metadata; the four retained archives cover npm packages, not full browser-engine source. The strict source check remains blocked. A completed technical test is not a substitute for a reasoned review record.

Record the exact release version, binary/source hashes, reviewer, review date, conclusion, scope and any conditions. Do not fill in a passed conclusion until the review and supporting evidence exist. Source additions do not retrofit legal notices into an installer already built or signed.
