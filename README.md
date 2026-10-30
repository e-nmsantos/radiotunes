# 📻 Roc Waves / RadioTunes - Plataforma Mundial de Rádio Hi-Fi

Aplicação completa de streaming de mais de **45.000 estações de rádio mundiais** com lógica funcional em **Roc**, processamento de sinal digital (**DSP Web Audio**), gerador de **sons ambiente sintetizados**, **Equalizador Pro de 10 Bandas + Áudio 3D**, **Mini-Player Picture-in-Picture**, **Gravador DVR Agendado**, **Playlists Personalizadas**, **Histórico de Faixas & Letras**, explorador avançado de rádios por país, cidade e género, mapa mundial interativo, suporte a **PWA (Progressive Web App)**, **Multi-idioma (i18n)** e modo de exibição para TV / Ecrã Gigante.

🌐 **Acesso Online (GitHub Pages)**: [https://e-nmsantos.github.io/radiotunes/](https://e-nmsantos.github.io/radiotunes/)

---

## 🌟 Funcionalidades Top-Tier

### 🎚️ 1. Equalizador Gráfico Pro de 10 Bandas & Áudio 3D Espacial
* **10 Bandas de Frequência**: 32Hz, 64Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz e 16kHz com controlo de ganho (-12dB a +12dB).
* **Presets de Estúdio**: *Flat, Bass Boost, Rock, Pop, Vocal/Notícias, Jazz, Eletrónica, Sala de Concertos, Lo-Fi*.
* **Áudio 3D Espacial (*Stereo Widener*)**: Aumenta a sensação de amplitude e palco sonoro estéreo.
* **Reverberação DSP (*Concert Hall Reverb*)**: Simulação acústica de sala de concertos com Convolver DSP.
* **DSP consciente de CORS**: o áudio é encaminhado pelo grafo Web Audio (EQ 3D + reverb + visualizador real) sempre que o stream suporta CORS; streams sem CORS ficam automaticamente em modo de reprodução direta, sem nunca perder som. Com o **Proxy de Áudio** ligado (`node proxy/server.cjs`), o DSP funciona em *todas* as estações.
* **Now Playing real (ICY)**: com o proxy ativo, os metadados ICY do stream alimentam o título da faixa atual, o histórico e a Media Session — incluindo rádios que enviam XML (ex.: Bauermedia), normalizados para "Artista - Faixa".

### 🖼️ 2. Mini-Player Nativo Flutuante (*Picture-in-Picture*)
* Transforma o player numa janela flutuante nativa do sistema operativo via Picture-in-Picture API.
* Mostra o nome da rádio, estação atual e visualizador dinâmico de ondas enquanto navegas noutros programas ou ecrãs.

### 🎵 3. Histórico de Faixas ("Now Playing") & Letras
* Registo automático de músicas tocadas durante a sessão de rádio.
* **Pesquisa de Letras**: Abertura instantânea de pesquisa de letras da faixa atual.
* **Exportação Musical**: Links diretos com 1 clique para encontrar a faixa no **Spotify** ou **YouTube**.

### 📼 4. Gravador Agendado de Rádio (*Radio DVR*)
* **Gravação Manual**: Grava qualquer transmissão em direto com 1 clique e descarrega o ficheiro de áudio `.webm` / `.mp3`.
* **Agendamento Automático**: Programa gravações para um horário específico com duração configurável (ex: 15, 30, 60 minutos) com download automático após a conclusão.

### 📁 5. Gestor de Playlists & Pastas Personalizadas
* Cria e gere pastas temáticas (ex: *Trabalho, Treino, Noite, Chillout*).
* Adiciona e remove rádios a qualquer playlist com facilidade.
* Reprodução contínua da lista temática.

### 🔍 6. Explorador Avançado de Rádios (+45.000 Estações)
* **Filtros Combinados**: Pesquisa cruzada por **País**, **Cidade / Região**, **Estilo Musical / Tag**, **Bitrate Mínimo (HD)** e **Presença de Logótipo**.
* **Ordenação Inteligente**: Por Mais Populares (Cliques), Mais Votadas, Melhor Qualidade de Áudio ou Ordem Alfabética (A-Z).
* **Gestão da Coleção Pessoal**:
  * 📌 **"Incluir / Fixar na Minha Biblioteca"**: Guarda estações descobertas permanentemente na tua biblioteca.
  * ⭐ **"Favoritos"**: Acesso instantâneo com um clique.

### 🌧️ 7. Misturador de Sons Ambiente (*Ambient Soundscapes DSP*)
* Gerador de áudio sintetizado em tempo real via Web Audio API (100% offline, sem ficheiros pesados):
  * 🌧️ **Chuva Suave (*Pink Noise Filter*)**
  * 🌊 **Ondas do Mar (*Ocean Breeze Wave*)**
  * 🔥 **Lareira (*Fire Embers Crackle*)**
  * 🧠 **Ruído Branco / Foco (*Acoustic Masking*)**
* Permite ouvir a rádio em simultâneo com sons relaxantes para trabalho, foco ou sono, com controlo de volume independente.

### 🌐 8. Multi-idioma (*i18n*)
* Alternância instantânea de idioma: **Português 🇵🇹**, **English 🇬🇧**, **Español 🇪🇸** e **Français 🇫🇷**.

### 📺 9. Modo TV & Visualizador 3D (*Halo Neon*)
* Ativado com a tecla **`F`** ou no botão do player.
* Alterna entre **Barras de Espectro Hi-Fi** e **Halo 3D Circular Waveform**.
* Relógio digital em tempo real e capa gigante para salas ou segundo ecrã.

### 🗺️ 10. Mapa Mundial Interativo (*Radio Garden Style*)
* Mapa geográfico mundial escuro em **Leaflet.js** com pontos interativos nas principais capitais e cidades do mundo.

### ⏰ 11. Despertador com Rádio (*Radio Alarm Clock*)
* Permite programar um alarme para qualquer hora do dia associado à tua rádio preferida, com aumento gradual de volume (*gentle wake-up*) e *Snooze* (5 min).

### 📱 12. PWA & Media Session API
* Instalação como app nativa no Windows, Mac, Android e iOS.
* Controlos completos no ecrã de bloqueio do smartphone e através de botões de auscultadores Bluetooth.

### 💾 13. Backup & Exportação M3U
* Exportar/Importar coleções em `.json`.
* Descarregar a lista global no formato padrão `.m3u` compatível com VLC e iTunes.

---

## 📂 Ficheiros do Projeto

* [`Radio.roc`](Radio.roc): Regras de negócio funcionais (estações, favoritos, filtros avançados, biblioteca, 10-Band EQ, DVR agendado, playlists, sleep timer, alarmes e M3U com 14 testes unitários).
* [`js/roc-core.js`](js/roc-core.js): Porto JS fiel das regras de `Radio.roc` — usada diretamente pela UI (navegação cíclica, M3U, filtros) e testada em `test/roc-core.test.mjs` (14 testes `node --test`).
* [`js/storage.js`](js/storage.js): Camada IndexedDB com cache TTL de 24h para a API radio-browser e persistência das estações descobertas no mapa.
* [`js/app.js`](js/app.js): Lógica da aplicação (catálogo, mapa, DSP Web Audio, DVR, playlists, i18n, proxy de áudio) — carregada pelo `index.html`.
* [`tools/health-check.cjs`](tools/health-check.cjs): **Agente de Saúde do Catálogo** — audita os ~88 streams + logos (classifica OK / morto / inacessível, deteta suporte de CORS para DSP) e sugere substitutos da radio-browser. Executar com `node tools/health-check.cjs` (relatório) ou `--fix` (aplica só substituições seguras: 4xx/5xx confirmados + país igual + nome compatível + stream verificado). Relatórios em `tools/reports/`.
* [`.github/workflows/health-check.yml`](.github/workflows/health-check.yml): o agente corre **automaticamente toda a semana** no GitHub Actions e abre um *issue* com as estações em falha — detenção contínua sem servidor.
* [`proxy/server.cjs`](proxy/server.cjs): **Proxy de Áudio zero-dependências** (Node.js): resolve CORS e mixed-content de qualquer stream, expõe metadados ICY reais (`/icy`) para o "Now Playing" e **extrai o stream de qualquer site de rádio** (`/extract` — HTML, bundles JS, padrão Supabase e subdomínios de streaming). Arranca com `node proxy/server.cjs` (porta 8787) ou opção 6 do `run.ps1`; a app deteta-o automaticamente.
* [`manifest.json`](manifest.json) & [`sw.js`](sw.js): Configuração PWA e cache offline (cache-first para assets estáticos, network-first para HTML).
* [`server.ps1`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/server.ps1): Servidor HTTP local em PowerShell com CORS ativado.
* [`run.ps1`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/run.ps1) & [`run.bat`](file:///c:/Users/nunom/Downloads/Programa%C3%A7%C3%A3o%20NMS/RadioTunes%20-%20ROC/run.bat): Launcher com menu interativo.

---

## 🚀 Como Abrir e Usar

1. **Duplo clique em [`run.bat`](run.bat)** — abre o player direto no navegador, sem menus nem consolas. (O menu de desenvolvimento continua disponível executando `run.ps1` no PowerShell.)
2. Para correr os testes unitários em Roc:
   ```powershell
   roc test Radio.roc
   ```
3. Para correr os testes JS do RocCore:
   ```powershell
   node --test test/roc-core.test.mjs
   ```
4. *(Recomendado)* Para DSP total, Now Playing real e streams `http://`:
   ```powershell
   .\proxy.bat   # ou: node proxy/server.cjs — deixa a janela aberta
   ```
5. Verificação de saúde dos streams + logos (agente de manutenção):
   ```powershell
   node tools/health-check.cjs          # relatório → tools/reports/summary.md
   node tools/health-check.cjs --fix    # repara automaticamente os mortos confirmados
   ```

---

## ⌨️ Atalhos de Teclado
* `Espaço` : Reproduzir / Pausar (*Play/Pause*)
* `Seta Direita / Esquerda` : Estação seguinte / anterior
* `Seta Cima / Baixo` : Aumentar / diminuir volume
* `M` : Mudo (*Mute*)
* `F` : Abrir Modo TV / Ecrã Gigante
* `Esc` : Fechar Modo TV

---

## 👨‍💻 Autor & Marca

**© 2026 Nuno Santos** — *Todos os direitos reservados.*

