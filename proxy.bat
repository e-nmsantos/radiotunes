@echo off
chcp 65001 > nul
title Roc Waves - Proxy de Audio (DSP total + Now Playing)
rem ============================================================
rem  Proxy de audio: deixa ESTA janela aberta e abre a app
rem  (ou duplo clique em run.bat). A app deteta o proxy sozinha.
rem  Fecha esta janela para parar o proxy.
rem ============================================================
where node > nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)
node "%~dp0proxy\server.cjs"
pause
