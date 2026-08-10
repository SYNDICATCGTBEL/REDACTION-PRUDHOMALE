$ErrorActionPreference = 'Stop'

$certificate = Join-Path $PSScriptRoot '..\certificates\Syndicat-CGT-BEL-Code-Signing.cer'
if (-not (Test-Path -LiteralPath $certificate)) {
  throw "Certificat public introuvable : $certificate"
}

Import-Certificate -FilePath $certificate -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Import-Certificate -FilePath $certificate -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null
Write-Host 'Le certificat Syndicat CGT BEL est approuvé pour le compte Windows actuel.'
