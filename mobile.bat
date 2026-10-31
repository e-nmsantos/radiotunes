@echo off
chcp 65001 > nul
title Roc Waves - Teste no Telemovel (servidor Wi-Fi)
rem ============================================================
rem  Serve a app para testar no TELEMOVEL:
rem  1. Telemovel na MESMA rede Wi-Fi que este PC
rem  2. Abre no telemovel o endereco mostrado na janela
rem  3. Windows pode pedir para permitir o Node na firewall:
rem     clica "Permitir acesso"
rem  O proxy de audio arranca noutra janela em modo rede local
rem ============================================================
where node > nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)
start "Roc Waves - Proxy (rede local)" node "%~dp0proxy\server.cjs" --lan
node "%~dp0tools\serve.cjs"
pause
