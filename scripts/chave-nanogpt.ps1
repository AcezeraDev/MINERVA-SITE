<#
  Grava a chave da NanoGPT (NANOGPT_API_KEY) no .env.local, para a Mine
  responder quando o site roda no seu computador (npm run dev).

  A chave e digitada escondida aqui no terminal. Ela nao aparece na tela, nao
  vai para o chat e so e gravada no .env.local, que o git ignora. Antes de
  gravar, o script testa a chave com um pedido minusculo a NanoGPT (1 token).

  Uso (na pasta do projeto):
    powershell -ExecutionPolicy Bypass -File scripts\chave-nanogpt.ps1
  Gravar sem testar a chave:
    powershell -ExecutionPolicy Bypass -File scripts\chave-nanogpt.ps1 -SemTestar
#>
param([switch]$SemTestar)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$arquivo = Join-Path $raiz ".env.local"
$nome = "NANOGPT_API_KEY"

function Ler-Segredo([string]$pergunta) {
  $segura = Read-Host -Prompt $pergunta -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "Chave da NanoGPT para o Minerva local" -ForegroundColor Cyan
Write-Host "Pegue em https://nano-gpt.com/api (ou copie a mesma que esta na Vercel)."
Write-Host "(o que voce colar nao aparece na tela; cole e aperte Enter)"
Write-Host ""

$chave = (Ler-Segredo "Chave").Trim()
if ($chave.Length -lt 16) {
  Write-Host "Isso nao parece uma chave (curta demais). Nada foi alterado." -ForegroundColor Red
  exit 1
}
if ($chave -match "\s") {
  Write-Host "A chave nao pode ter espacos no meio. Nada foi alterado." -ForegroundColor Red
  exit 1
}

if (-not $SemTestar) {
  Write-Host "Testando a chave na NanoGPT..." -ForegroundColor DarkGray
  $corpo = @{ model = "anthropic/claude-haiku-5.5"; max_tokens = 1; messages = @(@{ role = "user"; content = "oi" }) } | ConvertTo-Json -Depth 4
  try {
    $null = Invoke-RestMethod -Method Post -Uri "https://nano-gpt.com/api/v1/chat/completions" `
      -Headers @{ Authorization = "Bearer $chave" } -ContentType "application/json" -Body $corpo -TimeoutSec 40
    Write-Host "    a chave funciona." -ForegroundColor DarkGray
  } catch {
    $codigo = $null
    if ($_.Exception.Response) { $codigo = [int]$_.Exception.Response.StatusCode }
    if ($codigo -eq 401 -or $codigo -eq 403) {
      Write-Host "A NanoGPT recusou essa chave (codigo $codigo). Confira se copiou inteira. Nada foi alterado." -ForegroundColor Red
      $chave = $null
      exit 1
    }
    if ($codigo -eq 402) {
      Write-Host "A chave e valida, mas a conta da NanoGPT esta sem saldo (codigo 402)." -ForegroundColor Yellow
    } else {
      Write-Host "Nao deu para testar agora (codigo $codigo). A chave sera gravada mesmo assim." -ForegroundColor Yellow
    }
  }
}

# Troca so a linha da chave e mantem o resto do .env.local como esta.
$linhas = @()
if (Test-Path $arquivo) { $linhas = @(Get-Content $arquivo | Where-Object { $_ -notmatch "^\s*$nome\s*=" }) }
$linhas += "$nome=$chave"
[IO.File]::WriteAllLines($arquivo, [string[]]$linhas)
$chave = $null

Write-Host ""
Write-Host "Pronto! A chave foi gravada no .env.local." -ForegroundColor Green
Write-Host "Reinicie o servidor (pare o npm run dev com Ctrl+C e rode de novo) para a Mine responder."
