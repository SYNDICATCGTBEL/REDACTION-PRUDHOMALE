$ErrorActionPreference = 'Stop'

$subject = 'CN=Syndicat CGT BEL'
$friendlyName = 'Syndicat CGT BEL - Signature interne des logiciels'
$certificateDirectory = Join-Path $PSScriptRoot '..\certificates'
$publicCertificate = Join-Path $certificateDirectory 'Syndicat-CGT-BEL-Code-Signing.cer'

New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null

$certificate = Get-ChildItem -Path Cert:\CurrentUser\My |
  Where-Object {
    $_.Subject -eq $subject -and
    $_.HasPrivateKey -and
    $_.NotAfter -gt (Get-Date).AddDays(30) -and
    $_.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3'
  } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if (-not $certificate) {
  $certificate = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $subject `
    -FriendlyName $friendlyName `
    -CertStoreLocation 'Cert:\CurrentUser\My' `
    -KeyAlgorithm RSA `
    -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears(5)
}

Export-Certificate -Cert $certificate -FilePath $publicCertificate -Force | Out-Null
Import-Certificate -FilePath $publicCertificate -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Import-Certificate -FilePath $publicCertificate -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null

Write-Host 'Certificat interne prêt.'
Write-Host "Sujet       : $($certificate.Subject)"
Write-Host "Empreinte   : $($certificate.Thumbprint)"
Write-Host "Expiration  : $($certificate.NotAfter.ToString('dd/MM/yyyy'))"
Write-Host "Certificat public : $publicCertificate"
