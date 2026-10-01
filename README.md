# 📻 Roc Waves / RadioTunes - Plataforma Mundial de Rádio Hi-Fi

Aplicação completa de streaming de mais de **45.000 estações de rádio mundiais** com lógica funcional em **Roc**, processamento de sinal digital (**DSP Web Audio**), gerador de **sons ambiente sintetizados**, explorador avançado de rádios por país, cidade e género, mapa mundial interativo, suporte a **PWA (Progressive Web App)**, **Multi-idioma (i18n)** e modo de exibição para TV / Ecrã Gigante.

---

## 🌟 Funcionalidades Top-Tier

### 🔍 1. Explorador Avançado de Rádios (+45.000 Estações)
* **Filtros Combinados**: Pesquisa cruzada por **País**, **Cidade / Região**, **Estilo Musical / Tag**, **Bitrate Mínimo (HD)** e **Presença de Logótipo**.
* **Ordenação Inteligente**: Por Mais Populares (Cliques), Mais Votadas, Melhor Qualidade de Áudio ou Ordem Alfabética (A-Z).
* **Gestão da Coleção Pessoal**:
  * 📌 **"Incluir / Fixar na Minha Biblioteca"**: Guarda estações descobertas permanentemente na tua biblioteca.
  * ⭐ **"Favoritos"**: Acesso instantâneo com um clique.

### 🌧️ 2. Misturador de Sons Ambiente (*Ambient Soundscapes DSP*)
* Gerador de áudio sintetizado em tempo real via Web Audio API (100% offline, sem ficheiros pesados):
  * 🌧️ **Chuva Suave (*Pink Noise Filter*)**
  * 🌊 **Ondas do Mar (*Ocean Breeze Wave*)**
  * 🔥 **Lareira (*Fire Embers Crackle*)**
  * 🧠 **Ruído Branco / Foco (*Acoustic Masking*)**
* Permite ouvir a rádio em simultâneo com sons relaxantes para trabalho, foco ou sono, com controlo de volume independente.

### 🌐 3. Multi-idioma (*i18n*)
* Alternância instantânea de idioma: **Português 🇵🇹**, **English 🇬🇧**, **Español 🇪🇸** e **Français 🇫🇷**.

### 📺 4. Modo TV & Visualizador 3D (*Halo Neon*)
* Ativado com a tecla **`F`** ou no botão do player.
* Alterna entre **Barras de Espectro Hi-Fi** e **Halo 3D Circular Waveform**.
* Relógio digital em tempo real e capa gigante para salas ou segundo ecrã.

### 🗺️ 5. Mapa Mundial Interativo (*Radio Garden Style*)
* Mapa geográfico mundial escuro em **Leaflet.js** com pontos interativos nas principais capitais e cidades do mundo.

### ⏰ 6. Despertador com Rádio (*Radio Alarm Clock*)
* Permite programar um alarme para qualquer hora do dia associado à tua rádio preferida, com aumento gradual de volume (*gentle wake-up*) e *Snooze* (5 min).

### 🎚️ 7. Equalizador DSP & Áudio Hi-Fi (Web Audio API)
* Equalizador de 3 Bandas: **Graves** (150Hz), **Médios** (1kHz) e **Agudos** (3.5kHz) com presets (*Flat, Bass Boost, Rock, Pop, Voz/Notícias, Jazz, Lo-Fi*).

### 📱 8. PWA & Media Session API
* Instalação como app nativa no Windows, Mac, Android e iOS.
* Controlos completos no ecrã de bloqueio do smartphone e através de botões de auscultadores Bluetooth.

### 💾 9. Backup & Exportação M3U
* Exportar/Importar coleções em `.json`.
* Descarregar a lista global no formato padrão `.m3u` compatível com VLC e iTunes.

---

## 📂 Ficheiros do Projeto

* [`Radio.roc`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/Radio.roc): Regras de negócio funcionais (estações, favoritos, filtros avançados, biblioteca, EQ, Sleep Timer, Alarmes e M3U com 10 testes unitários).
* [`index.html`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/index.html): Interface web completa, responsiva e moderna.
* [`manifest.json`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/manifest.json) & [`sw.js`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/sw.js): Configuração PWA e cache offline.
* [`server.ps1`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/server.ps1): Servidor HTTP local em PowerShell com CORS ativado.
* [`run.ps1`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/run.ps1) & [`run.bat`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/run.bat): Launcher com menu interativo.

---

## 🚀 Como Abrir e Usar

1. Dá **duplo clique** em [`run.bat`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/run.bat) ou [`index.html`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/index.html).
2. Para correr os testes unitários em Roc:
   ```powershell
   roc test Radio.roc
   ```

---

## ⌨️ Atalhos de Teclado
* `Espaço` : Reproduzir / Pausar (*Play/Pause*)
* `Seta Direita / Esquerda` : Estação seguinte / anterior
* `Seta Cima / Baixo` : Aumentar / diminuir volume
* `M` : Mudo (*Mute*)
* `F` : Abrir Modo TV / Ecrã Gigante
* `Esc` : Fechar Modo TV
