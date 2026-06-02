# 025 - [Automação / Extrator]: Extração Automatizada de Stems via Emulação Headless

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 02/06/2026

---

## 🚀 Desafio de Engenharia
O ecossistema do Mixer8 depende da separação precisa de faixas originais de áudio em múltiplos canais independentes (stems) para alimentar a mesa de som e o player interativo. A automação anterior baseada em injeção de links de nuvem sofria com instabilidades de rede, falhas de sincronização e problemas de redirecionamento. 

Além disso, enfrentamos três problemas complexos na interação com a interface da plataforma externa de processamento de áudio:
1. **Colisão de Seletores na Exportação**: O link para download do mix completo estéreo e o link para exportação de todas as stems separadas compartilhavam classes CSS idênticas no menu de contexto do player. Isso fazia com que o robô baixasse apenas o arquivo estéreo padrão em vez do pacote compactado (.zip) com todos os canais.
2. **Arquitetura Baseada em IFrames**: Tanto o painel de upload quanto a interface do player/DAW da plataforma parceira rodam dentro de contêineres inline (IFrames) dinâmicos, impedindo a seleção direta de elementos DOM a partir da página raiz.
3. **Corrupção de Pacotes por Transcodificação Assíncrona**: O botão "Exportar" tornava-se visível na interface assim que o player era carregado. Contudo, se o download fosse solicitado imediatamente, o servidor parceiro gerava um arquivo compactado corrompido ou incompleto (ex: 1MB em vez de 4MB) porque os canais de áudio ainda estavam sendo gerados em segundo plano.

## 🧠 Estratégia da Solução
Para garantir robustez absoluta de ponta a ponta sem expor ou depender de chaves oficiais, adotamos uma abordagem de emulação de comportamento humano de alta precisão:
1. **Uploader Local via Playwright**: Substituímos o fluxo de importação por URL externa pela injeção local de arquivos usando as capacidades nativas de envio de arquivos da ferramenta de automação, direcionando a interação diretamente para a aba de arquivos locais.
2. **Resolução Dinâmica de IFrames**: Implementamos um algoritmo de varredura que mapeia todos os quadros ativos (`page.Frames`), analisa o conteúdo de texto deles e localiza programaticamente o IFrame interno correto que gerencia a interface do player e do uploader.
3. **Seleção de Formato e Desambiguação de Cliques**: Adicionamos comandos para selecionar explicitamente o formato MP3 antes de disparar o download e reestruturamos os seletores CSS com base em correspondência de texto parcial para garantir o clique exclusivo no botão de exportação multicanal.
4. **Portão de Tempo Dinâmico (Time Gate)**: Implementamos um tempo de espera inteligente calculado em tempo de execução com base no tamanho físico (em bytes) do arquivo de áudio original (definindo atrasos seguros de 2, 3 ou 4 minutos), garantindo que o servidor parceiro tenha concluído todo o processamento de áudio antes de solicitar o download.
5. **Autorecuperação de Teste**: Adicionamos um utilitário na inicialização do serviço que lista os últimos registros de banco de dados e redefine faixas presas em status de processamento ou falha para "Aguardando", permitindo o reteste ágil.

## 🛠️ Implementação Técnica

### Backend API (.NET 10 & C# 13)
* **Novo Endpoint no [TracksController](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)**: Criação da rota `GET /api/Tracks/{id}/original` que resolve o caminho físico do áudio original de upload e o serve via arquivo físico com cabeçalhos apropriados de tipo de conteúdo (Content-Type) e suporte a streaming parcial (HTTP Range).

### Extrator de Stems (.NET 10 Worker & Playwright)
* **Perfil Persistente no [Worker](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**: Configuração do Chromium para usar a pasta local `user_profile` como contexto persistente, mantendo a autenticação e cookies ativos mesmo em reinicializações do serviço.
* **Algoritmo de Detecção de Frames**:
  - Varredura de `page.Frames` procurando palavras-chave do uploader ou do player.
  - Execução de ações de preenchimento de inputs e cliques direcionadas ao frame mapeado (`interactionFrame` e `playerFrame`).
* **Seletor de Canal de Exportação**:
  - Redefinição de `exportAllSelector` priorizando `a:has-text('Exportar todos os canais')` sobre classes dinâmicas geradas no build.
  - Inclusão do clique preventivo no botão de seleção de formato "MP3".
* **Espera Dinâmica**:
  - Leitura do tamanho do arquivo local (`FileInfo.Length`).
  - Lógica condicional de `Task.Delay` definindo 120s, 180s ou 240s de cooldown absoluto antes de acionar a exportação.

## 🎯 Impacto e Resultado
* **Download 100% Funcional**: Extração completa de todas as stems em pacotes ZIP íntegros sem truncamentos de áudio.
* **Resiliência e Tolerância a Falhas**: Tratamento robusto de carregamento lento por meio de timeouts de rede tolerantes (espera DOMContentLoaded) e tratamento de erros com captura automática de tela (screenshot) em falhas.
* **Segurança e Estabilidade**: O reuso de perfil persistente reduz o tráfego de autenticação e mitiga o risco de bloqueios por atividade robótica suspeita na plataforma parceira.

---
**Nota do Desenvolvedor:** *A inclusão de uma barreira temporal baseada no tamanho do arquivo resolveu de forma elegante o problema de sincronização assíncrona da plataforma externa. O uploader local direto no input provou ser muito mais rápido e previsível do que depender de importação em nuvem, acelerando o ciclo de processamento global do ecossistema.*
