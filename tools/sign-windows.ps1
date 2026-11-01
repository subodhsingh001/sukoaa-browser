# SPDX-License-Identifier: GPL-3.0-or-later
# Run on the release owner's Windows machine after branding/build, never in PR CI.
param([Parameter(Mandatory=$true)][string]$AppDirectory,
      [Parameter(Mandatory=$true)][string]$CertificateThumbprint,
      [Parameter(Mandatory=$true)][string]$SignTool,
      [Parameter(Mandatory=$true)][string]$TimestampUrl)
$ErrorActionPreference = 'Stop'
node "$PSScriptRoot/release-gate.cjs" --pre-sign
if ($LASTEXITCODE -ne 0) { throw 'Public release gate blocked; do not sign/publish this candidate as cleared.' }
$certificate = Get-Item "Cert:\CurrentUser\My\$CertificateThumbprint"
if (-not $certificate.HasPrivateKey -or $certificate.NotAfter -lt (Get-Date)) { throw 'Missing private key or expired publisher certificate' }
$exe = Join-Path $AppDirectory 'Sukoaa Browser.exe'
& $SignTool sign /sha1 $CertificateThumbprint /fd SHA256 /tr $TimestampUrl /td SHA256 $exe
if ($LASTEXITCODE -ne 0) { throw 'Signing failed' }
& $SignTool verify /pa /all /v $exe
if ($LASTEXITCODE -ne 0) { throw 'Signature verification failed' }
Get-FileHash -Algorithm SHA256 $exe
# Review and sign other executable payloads as required by your distribution policy.
# Create final archive/manifest only AFTER signing. Never store/export private keys here.
