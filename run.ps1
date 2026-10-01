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
    Write-Host " 6. Sair"
    Write-Host "=========================================" -ForegroundColor Cyan
    $choice = Read-Host "Escolhe uma opcao (1-6)"
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
    } while ($continue -ne "q" -and $opt -ne "6")
}
