$ErrorActionPreference = 'Stop'

$certificate = Get-ChildItem -Path Cert:\CurrentUser\My |
  Where-Object {
    $_.Subject -eq 'CN=Syndicat CGT BEL' -and
    $_.HasPrivateKey -and
    $_.NotAfter -gt (Get-Date) -and
    $_.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3'
  } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if (-not $certificate) {
  throw "Certificat interne introuvable. Exécutez d'abord scripts\create-internal-certificate.ps1."
}

Push-Location (Join-Path $PSScriptRoot '..')
try {
  $builder = Join-Path (Get-Location) 'node_modules\.bin\electron-builder.cmd'
  if (-not (Test-Path -LiteralPath $builder)) { throw 'electron-builder est introuvable. Exécutez npm install.' }
  & $builder --win nsis "--config.win.signtoolOptions.certificateSha1=$($certificate.Thumbprint)"
  if ($LASTEXITCODE -ne 0) { throw "La construction signée a échoué (code $LASTEXITCODE)." }
} finally {
  Pop-Location
}
