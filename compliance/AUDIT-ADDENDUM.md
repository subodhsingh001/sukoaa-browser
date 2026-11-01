# Sukoaa Browser 0.9.0 — source and licensing audit addendum

Prepared 1 November 2026. Status: **technical evidence improved; public-release clearance remains pending**.

This adds source archives, metadata, checks and review instructions. It does not change the browser's feature code, adopt another application license, remove blocking features, grant trademark rights, rebuild/sign an installer, publish a release, or certify compliance. The application version stays 0.9.0. Existing installers/APKs have not been rebuilt with these additional notices.

## Work completed

| Item | Verified result | Limit |
|---|---|---|
| Desktop npm dependency source | Four upstream source archives cover all 13 runtime package/version records. Downloaded bytes match every recorded SHA256 and the lockfile version/integrity entries. | Source availability and metadata consistency are not a legal compatibility conclusion. |
| Retained source integrity | check-compliance.cjs reads real source bytes, checks hashes/gzip/tar format, rejects missing files, traversal and symlinks, and checks the runtime dependency closure. | It cannot prove that an upstream author has all rights or that every obligation is satisfied. |
| Android license declarations | 52 unique coordinates, representing 53 recorded artifacts, have POM files captured from the applicable official Maven repositories with SHA256 records. | POMs are declarations, not component source or a complete all-platform SBOM. Three POMs do not directly declare a license; inherited/actual artifact notices still need review. |
| Android SDK terms | Four Google Play services POMs explicitly declare Android Software Development Kit License. They are separately identified in the notices and report. | Do not blanket-label these as GPL/MIT/MPL. A reviewer must evaluate redistribution and compatibility with the application. |
| Filter/scriptlet mirror | Current pinned raw files match the retained provenance hashes. The immutable mirror update script has been captured. | The script obtains generated resources from a CDN; this does not close preferred-form upstream source/conversion mapping. |
| Release checks | The public/pre-sign CLI gate now also checks the actual retained source package. | Existing owner approval, legal and device-evidence checks remain false. No clearance was fabricated. |

## A concrete problem repaired

The older SukoaaBrowser-Source-Audit-Bundle.zip (12,597,592 bytes) lacks its ZIP end directory and cannot be opened as a valid ZIP. Inspecting local headers also fails validation on a compressed source entry. The old bundle must not be relied on as a usable corresponding-source delivery. Its evidence assessment is retained in legacy-companion-assessment.json.

The four replacement archives are now **inside this source package**, under compliance/sources/. They were fetched at the exact recorded git revisions and independently checked against the hashes already in npm-source-records.json. The corrupt companion was not silently marked valid or published as a repaired legal bundle.

## Run the checks

From the source root (Node 24):

```text
node tools/check-compliance.cjs --write
node tools/check-compliance.cjs --strict
node tools/release-gate.cjs
```

The first command verifies retained files and writes compliance/current-review.json. Zero integrity errors means the retained subset is intact. It does **not** mean public release is cleared. The strict check and release gate are expected to return a nonzero status until source and legal reviews and the existing release requirements are actually completed. Do not flip evidence flags to make them green.

For the regular tests:

```text
cd desktop
npm ci --ignore-scripts
npm test
```

Ignore-scripts is sufficient for these JavaScript tests and avoids downloading/executing native installation hooks. It does not install a runnable Electron binary for native browser checks. Normal application/native builds still require the documented full setup.

To reacquire source and metadata with Python 3 and internet access:

```text
python3 tools/capture-npm-source.py
python3 tools/capture-android-license-metadata.py
node tools/check-compliance.cjs --write
```

The npm script rejects a hash mismatch. The Android script records first-party metadata and its observed hash; it does not turn a POM's license name into a legal opinion. Review changes rather than accepting a new metadata snapshot automatically. No source archive is executed by either capture script.

## Validation performed

- All 32 JavaScript tests passed (zero failures or skips).
- The source/inventory integrity check passed: four archives, 13 npm records and 52 Android metadata records; zero integrity errors.
- The public release gate returned its expected blocked status, retaining the unresolved source, owner, signing and device requirements.
- Native Windows/Linux/Android execution and installer signing were not performed in this audit.

## What still needs an exact source/release review

1. **uBlock-derived executable scriptlets.** Establish the exact preferred-form upstream revision and the conversion/build tool that produced the retained resources.json. Include that preferred source and build instructions and verify the resulting mapping. Keeping only minified bodies, mirror files or a link to a moving branch is not treated as closure.
2. **Electron/Chromium and GeckoView.** Preserve notices from each actual shipped runtime. Confirm exact engine revisions and bundled dependency obligations, including copyleft components, against the binaries being distributed. The existing 498-entry Chromium inventory records hashes/locators; it is not 498 individually cleared components or a complete engine source collection.
3. **Android components.** Inspect the actual resolved binaries, embedded notices, POM inheritance and matching source where required. Review the four Android SDK-licensed transitives. Do not remove them without assessing and testing features such as platform authentication.
4. **Versioned public source delivery.** Once complete, publish the reviewed source/build inputs alongside the matching application release at a stable public location. Confirm anonymous users can download and open it. Retain versioned inputs; this audit ZIP alone does not close every browser component's obligations.

## What the owner needs to provide

- The real publisher name and the support/privacy/security contact you want made public. Do not substitute a personal or employer address without authorization.
- The final public product/privacy/source URLs under your control. A domain purchase alone is not trademark clearance.
- A qualified review of the Sukoaa name/logo and the unresolved license/combination questions.
- The existing release process's publisher signing and real-device evidence. A signature does not prove copyright compliance, and this task does not cancel or complete an external signing submission.

Use OWNER-REVIEW-HANDOFF.md as a short brief for that review. A technical check cannot guarantee zero copyright, patent, trademark, contract or privacy claims.

## References checked

- GPLv3 text included in LICENSE. GNU license guidance: https://www.gnu.org/licenses/gpl-faq.en.html
- Mozilla MPL FAQ (source distribution, minified JavaScript, and combination questions): https://www.mozilla.org/en-US/MPL/2.0/FAQ/
- EasyList license choices and external-list caveat: https://easylist.to/pages/licence.html
- Android SDK terms linked by the captured Google Play services POMs: https://developer.android.com/studio/terms
- Google's notice guidance: https://developers.google.com/android/guides/opensource

The current declared application license remains GPL-3.0-or-later, with upstream component terms retained. Technical evidence here is prepared for review; it is not legal clearance.
