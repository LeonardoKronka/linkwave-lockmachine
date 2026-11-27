# Gera deploy/linkwave-site.zip só com os arquivos que vão para o cPanel.
# Uso, na pasta do projeto:  powershell -ExecutionPolicy Bypass -File deploy\gerar-zip.ps1

$raiz = Split-Path -Parent $PSScriptRoot
$etapa = Join-Path $env:TEMP 'linkwave-deploy'
if (Test-Path $etapa) { Remove-Item $etapa -Recurse -Force }
New-Item -ItemType Directory -Path $etapa | Out-Null

foreach ($arquivo in 'index.html', 'lockmachine.html', 'privacidade.html', 'termos.html', '.htaccess') {
    Copy-Item (Join-Path $raiz $arquivo) $etapa
}
foreach ($pasta in 'assets', 'app', 'api') {
    Copy-Item (Join-Path $raiz $pasta) $etapa -Recurse
}
$itens = @('index.html', 'lockmachine.html', 'privacidade.html', 'termos.html', '.htaccess', 'assets', 'app', 'api', 'downloads')

# App Android: o assetlinks.json prova que o app é deste domínio. O APK não entra no zip (este zip fica
# no Git e o APK não): ele sobe à mão para downloads/ no File Manager. A chave de assinatura nunca entra.
New-Item -ItemType Directory -Force -Path (Join-Path $etapa 'downloads') | Out-Null
if (Test-Path (Join-Path $raiz '.well-known\assetlinks.json')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $etapa '.well-known') | Out-Null
    Copy-Item (Join-Path $raiz '.well-known\assetlinks.json') (Join-Path $etapa '.well-known')
    $itens += '.well-known'
}

# Nunca enviar a configuração local, sessões nem contadores de teste (o servidor cria os seus)
Remove-Item (Join-Path $etapa 'api\config.local.php') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $etapa 'api\storage\sessoes') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $etapa 'api\storage\limites') -Recurse -Force -ErrorAction SilentlyContinue

$zip = Join-Path $PSScriptRoot 'linkwave-site.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Push-Location $etapa
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip $itens
Pop-Location
Remove-Item $etapa -Recurse -Force

Write-Host "Pronto: $zip"
