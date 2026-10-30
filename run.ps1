param (
    [string]$Action = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$RocPath = "$PSScriptRoot\roc_bin\roc_nightly-windows_x86_64-2026-09-18-1d982dc"
if ($env:PATH -notlike "*$RocPath*") {
    $env:PATH = "$RocPath;$env:PATH"
}

function Show-Menu {
    Clear-Host
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host "         ROC RADIO STUDIO                " -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Cyan
    Write-Host " 1. Abrir Player de Radio no Navegador"
    Write-Host " 2. Iniciar Servidor Local HTTP (localhost:8080)"
    Write-Host " 3. Executar Testes do Radio (Radio.roc)"
    Write-Host " 4. Formatar Codigo Roc (roc fmt)"
    Write-Host " 5. Abrir Consola Interativa (roc repl)"
    Write-Host " 6. Iniciar Proxy de Audio + DSP total (localhost:8787)"
    Write-Host " 7. Executar Testes JS do RocCore (node --test)"
    Write-Host " 8. Sair"
    Write-Host "=========================================" -ForegroundColor Cyan
    $choice = Read-Host "Escolhe uma opcao (1-8)"
    return $choice
}

function Run-Action ($act) {
    switch ($act.ToLower()) {
        "1" {
            Write-Host "`n--- A ABRIR INTERFACE VISUAL DA RADIO ---" -ForegroundColor Green
            Start-Process "$PSScriptRoot\index.html"
        }
        "web" {
            Start-Process "$PSScriptRoot\index.html"
        }
        "2" {
            Write-Host "`n--- A INICIAR SERVIDOR LOCAL HTTP ---" -ForegroundColor Green
            & "$PSScriptRoot\server.ps1"
        }
        "server" {
            & "$PSScriptRoot\server.ps1"
        }
        "3" {
            Write-Host "`n--- A EXECUTAR OS TESTES DO RADIO.ROC ---" -ForegroundColor Green
            roc test Radio.roc
        }
        "radio" {
            Write-Host "`n--- A EXECUTAR OS TESTES DO RADIO.ROC ---" -ForegroundColor Green
            roc test Radio.roc
        }
        "test" {
            Write-Host "`n--- A EXECUTAR OS TESTES DO RADIO.ROC ---" -ForegroundColor Green
            roc test Radio.roc
        }
        "4" {
            Write-Host "`n--- A FORMATAR CODIGO ---" -ForegroundColor Green
            roc fmt Radio.roc
        }
        "fmt" {
            Write-Host "`n--- A FORMATAR CODIGO ---" -ForegroundColor Green
            roc fmt Radio.roc
        }
        "5" {
            Write-Host "`n--- A ABRIR REPL (digita ':exit' para sair) ---" -ForegroundColor Green
            roc repl
        }
        "repl" {
            Write-Host "`n--- A ABRIR REPL (digita ':exit' para sair) ---" -ForegroundColor Green
            roc repl
        }
        "6" {
            Write-Host "`n--- A INICIAR PROXY DE AUDIO (DSP total + Now Playing) ---" -ForegroundColor Green
            Write-Host "    Deixa esta janela aberta e abre a app noutra janela/aba."
            Write-Host "    O proxy e detetado automaticamente pela app (localhost:8787)."
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            if ($nodeCmd) {
                & node "$PSScriptRoot\proxy\server.cjs"
            } else {
                Write-Host "Node.js nao encontrado. Instala em https://nodejs.org" -ForegroundColor Red
            }
        }
        "proxy" {
            & node "$PSScriptRoot\proxy\server.cjs"
        }
        "7" {
            Write-Host "`n--- A EXECUTAR OS TESTES DO ROCCORE (node --test) ---" -ForegroundColor Green
            $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
            if ($nodeCmd) {
                & node --test "$PSScriptRoot\test\roc-core.test.mjs"
            } else {
                Write-Host "Node.js nao encontrado. Instala em https://nodejs.org" -ForegroundColor Red
            }
        }
        "jstest" {
            & node --test "$PSScriptRoot\test\roc-core.test.mjs"
        }
        "8" {
            Write-Host "Ate a proxima!" -ForegroundColor Gray
            exit 0
        }
        default {
            Write-Host "Opcao invalida." -ForegroundColor Red
        }
    }
}

if ($Action -ne "") {
    Run-Action $Action
} else {
    do {
        $opt = Show-Menu
        Run-Action $opt
        Write-Host ""
        $continue = Read-Host "Pressiona ENTER para voltar ao menu (ou 'q' para sair)"
    } while ($continue -ne "q" -and $opt -ne "8")
}
