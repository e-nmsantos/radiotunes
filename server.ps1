# ==============================================================================
# Servidor HTTP Local para RadioTunes (PowerShell Nativo)
# Permite servir a Web App em http://localhost:8080 com suporte total a CORS
# ==============================================================================

param(
    [int]$Port = 8080
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Verifica se a porta está disponível
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Porta $Port ocupada. A tentar porta 8085..." -ForegroundColor Yellow
    $Port = 8085
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "       📻 ROC WAVES - SERVIDOR HTTP ATIVO              " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " URL: $prefix" -ForegroundColor Green
Write-Host " Pasta: $PSScriptRoot" -ForegroundColor Gray
Write-Host " Pressiona Ctrl + C para terminar o servidor." -ForegroundColor DarkGray
Write-Host "========================================================`n" -ForegroundColor Cyan

# Abre o browser automaticamente
Start-Process $prefix

# Dicionário MIME Types
$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".m3u"  = "audio/x-mpegurl; charset=utf-8"
    ".roc"  = "text/plain; charset=utf-8"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # CORS Headers
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.AddHeader("Access-Control-Allow-Headers", "*")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }

        $filePath = Join-Path $PSScriptRoot $urlPath.TrimStart('/').Replace('/', '\')

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $response.ContentType = $mime

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.StatusCode = 200
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - Ficheiro nao encontrado")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }

        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
