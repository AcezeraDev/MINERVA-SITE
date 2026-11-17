<#
  Troca a senha de admin do Minerva (variavel ADMIN_ACCESS_PASSWORD na Vercel)
  e republica o site para a senha nova valer.

  A senha e digitada escondida aqui no terminal e nunca e mostrada nem salva
  em arquivo (a nao ser no .env.local, se voce pedir).

  Uso (na pasta do projeto):
    powershell -ExecutionPolicy Bypass -File scripts\trocar-senha-admin.ps1
  So ver o que seria feito, sem mudar nada:
    powershell -ExecutionPolicy Bypass -File scripts\trocar-senha-admin.ps1 -Testar
#>
param(
  [switch]$Testar,
  # so confere o login da Vercel e sai (nao pede senha)
  [switch]$SoConferir
)

# "Continue", nao "Stop": no PowerShell 5.1 qualquer linha que a CLI da Vercel
# escreve no stderr (o proprio banner "Vercel CLI 58...") vira erro e, com
# "Stop", derruba o script. O resultado de cada comando e lido pelo codigo de saida.
$ErrorActionPreference = "Continue"
$raiz = Split-Path -Parent $PSScriptRoot
$nome = "ADMIN_ACCESS_PASSWORD"
$site = "minerva-liart.vercel.app"

# Chama o npx pelo node, sem passar pelo npx.cmd: o cmd.exe interpretaria
# caracteres da senha como & | ^ % < > e estragaria o valor.
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
$npxCli = if ($node) { Join-Path (Split-Path $node) "node_modules\npm\bin\npx-cli.js" } else { "" }
if (-not $node -or -not (Test-Path $npxCli)) {
  Write-Host "Nao achei o Node.js/npx nesta maquina. Nada foi alterado." -ForegroundColor Red
  exit 1
}

function Vercel {
  param([string[]]$argumentos, [switch]$soSaida)
  if ($soSaida) {
    $saida = & $node $npxCli --yes vercel@58 @argumentos --cwd $raiz 2>$null
  } else {
    $saida = & $node $npxCli --yes vercel@58 @argumentos --cwd $raiz 2>&1 | ForEach-Object { "$_" }
  }
  return [pscustomobject]@{ codigo = $LASTEXITCODE; saida = @($saida) }
}

function Ler-Senha([string]$pergunta) {
  $segura = Read-Host -Prompt $pergunta -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (-not (Test-Path (Join-Path $raiz ".vercel\project.json"))) {
  Write-Host "Nao achei .vercel\project.json em $raiz. Rode o script de dentro da pasta do projeto." -ForegroundColor Red
  exit 1
}

# confere o login ANTES de pedir a senha
Write-Host "Conferindo o login da Vercel..." -ForegroundColor DarkGray
$quem = Vercel @("whoami") -soSaida
$usuario = $quem.saida | Where-Object { $_ -match "^[A-Za-z0-9_.-]+$" } | Select-Object -Last 1
if ($quem.codigo -ne 0 -or -not $usuario) {
  Write-Host "Este terminal nao esta logado na Vercel. Rode primeiro:" -ForegroundColor Red
  Write-Host "  npx --yes vercel@58 login"
  Write-Host "e depois este script de novo. Nada foi alterado."
  exit 1
}
Write-Host "Logado como $usuario." -ForegroundColor DarkGray
if ($SoConferir) { exit 0 }

Write-Host ""
Write-Host "Trocar a senha de admin do Minerva" -ForegroundColor Cyan
Write-Host "(o que voce digitar nao aparece na tela)"
Write-Host ""

$senha = Ler-Senha "Senha nova"
if ($senha.Length -lt 8) {
  Write-Host "A senha precisa ter pelo menos 8 caracteres. Nada foi alterado." -ForegroundColor Red
  exit 1
}
if ($senha -match "^\s|\s$") {
  Write-Host "A senha nao pode comecar nem terminar com espaco. Nada foi alterado." -ForegroundColor Red
  exit 1
}
if ($senha.Contains('"')) {
  # o PowerShell 5.1 passa aspas duplas quebradas para programas externos
  Write-Host "A senha nao pode ter aspas duplas (`"). Nada foi alterado." -ForegroundColor Red
  exit 1
}
$confirma = Ler-Senha "Repita a senha"
if ($senha -cne $confirma) {
  Write-Host "As duas senhas nao batem. Nada foi alterado." -ForegroundColor Red
  exit 1
}
$confirma = $null

$atualizarLocal = (Read-Host "Trocar tambem no .env.local (para testar no localhost)? [s/N]") -match "^[sS]"

if ($Testar) {
  Write-Host ""
  Write-Host "[teste] Senha conferida ($($senha.Length) caracteres). Faria:" -ForegroundColor Yellow
  Write-Host "  vercel env add $nome production --value ******** --force --sensitive"
  if ($atualizarLocal) { Write-Host "  trocar a linha $nome no .env.local" }
  Write-Host "  vercel redeploy $site --target production"
  $senha = $null
  exit 0
}

Write-Host ""
Write-Host "1/3 Gravando a senha nova na Vercel..." -ForegroundColor Cyan
$gravou = Vercel @("env", "add", $nome, "production", "--value", $senha, "--force", "--sensitive", "--yes", "--non-interactive")
if ($gravou.codigo -ne 0) {
  Write-Host "A Vercel recusou a troca (codigo $($gravou.codigo)). Nada foi republicado." -ForegroundColor Red
  $gravou.saida | Where-Object { $_ -match "Error|rror:" } | Select-Object -First 5 | ForEach-Object { Write-Host "  $_" }
  $senha = $null
  exit 1
}
Write-Host "    feito." -ForegroundColor DarkGray

if ($atualizarLocal) {
  Write-Host "2/3 Atualizando o .env.local..." -ForegroundColor Cyan
  $arquivo = Join-Path $raiz ".env.local"
  $linhas = @()
  if (Test-Path $arquivo) { $linhas = @(Get-Content $arquivo | Where-Object { $_ -notmatch "^\s*$nome\s*=" }) }
  $linhas += "$nome=$senha"
  [IO.File]::WriteAllLines($arquivo, [string[]]$linhas)
} else {
  Write-Host "2/3 .env.local mantido como estava." -ForegroundColor DarkGray
}
$senha = $null

Write-Host "3/3 Republicando o site para a senha nova valer (leva uns 2 minutos)..." -ForegroundColor Cyan
$publicou = Vercel @("redeploy", $site, "--target", "production", "--non-interactive")
$publicou.saida | Where-Object { $_ -match "https://|Ready|rror" } | Select-Object -Last 4 | ForEach-Object { Write-Host "  $_" }
if ($publicou.codigo -ne 0) {
  Write-Host "A senha foi gravada, mas a republicacao falhou. Rode de novo so este comando:" -ForegroundColor Yellow
  Write-Host "  npx --yes vercel@58 redeploy $site --target production"
  exit 1
}

Write-Host ""
Write-Host "Pronto! A senha de admin nova ja vale em https://$site" -ForegroundColor Green
