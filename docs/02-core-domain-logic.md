# Lógica de Domínio e Experiência do Usuário (ADR-02)

Este documento descreve as joias da coroa do **Mixer8**: a lógica de sincronização do player de áudio multi-stem e o fluxo de extração headless automatizado.

---

## 1. O Core Player Dinâmico (1 a 10 Stems Opcionais)

Ao contrário de tocadores tradicionais de faixa única ou DAW de canais fixos, o tocador do **Mixer8** é 100% dinâmico e flexível:
* **Suporte Completo de 1 a 10 Stems**: A aplicação está preparada para lidar com qualquer combinação de faixas sob demanda, inclusive músicas de canal único (sem separação, reproduzidas como um tocador convencional estéreo).
* **A Matriz de 10 Stems Opcionais**:
  1. `Voz` (`vocals` ──> `Voz.mp3`): Canal isolado de vocais principais e backing vocals.
  2. `Bateria` (`drums` ──> `Bateria.mp3`): Percussão acústica/eletrônica.
  3. `Baixo` (`bass` ──> `Baixo.mp3`): Linhas de contrabaixo elétrico, acústico ou sintetizado.
  4. `Guitarra` (`guitars` ──> `Guitarra.mp3`): Guitarras elétricas, violões e solos.
  5. `Piano` (`piano` ──> `Piano.mp3`): Pianos acústicos e elétricos de cauda.
  6. `Teclado` (`keyboards` ──> `Teclado.mp3`): Sintetizadores, pads e órgãos.
  7. `Sopro` (`wind` ──> `Sopro.mp3`): Metais, flautas e instrumentos de sopro em geral.
  8. `Cordas` (`strings` ──> `Cordas.mp3`): Violinos, violoncelos e orquestrações de cordas.
  9. `Metronomo` (`metronome` ──> `Metronomo.mp3`): Faixa de clique guia de andamento sincronizado (sempre presente se extraído da plataforma externa).
  10. `Outros` (`other` ──> `Outros.mp3`): Efeitos, ambiências e instrumentos não categorizados acima (faixa residual, sempre presente).

### A Mecânica de Sincronização Sólida
Para garantir que as faixas não percam o sincronismo de tempo (drift) durante a reprodução no navegador, o frontend `mixer8-app` implementa a seguinte arquitetura de áudio:

```
                      ┌──────────────────────┐
                      │    Master Clock      │  <-- Relógio central da DAW
                      └──────────┬───────────┘
                                 │ Sincroniza Play/Pause/Seek
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
 ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
 │ Stem: Vocals │         │  Stem: Bass  │         │ Stem: Drums  │ ... (Até 10 stems)
 │  (Se houver) │         │  (Se houver) │         │  (Se houver) │
 └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
        │                        │                        │
        ▼                        ▼                        ▼
 ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
 │ GainNode Vol │         │ GainNode Vol │         │ GainNode Vol │
 └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
        └────────────────────────┼────────────────────────┘
                                 ▼
                     ┌───────────────────────┐
                     │ AudioContext Destination│ <-- Alto-falantes do Usuário
                     └───────────────────────┘
```

1. **Web Audio API**: O player utiliza a `Web Audio API` nativa do navegador para criar múltiplos fluxos de áudio independentes sob um mesmo `AudioContext`.
2. **Master Clock**: Um relógio central serve como âncora absoluta. Quando o usuário executa um *Seek*, o tempo de reprodução de todas as instâncias `AudioBufferSourceNode` ativas é reconfigurado de forma atômica no mesmo milissegundo.
3. **GainNodes Dinâmicos**: A interface gera controles de volume (`GainNode`) sob demanda apenas para os canais retornados na propriedade `Stems` da música. Se uma música possuir apenas as faixas `Voz` e `Bateria`, apenas estes dois sliders aparecerão, eliminando canais mortos ou fictícios (Mocks).

---

## 2. O Fluxo de Extração e Decodificação de Nomes (Headless Bot)

A jornada de criação de uma música com stems no Mixer8 se inicia no upload de um arquivo de áudio estéreo convencional. O microserviço `mixer8-extractor` (Worker C#) faz o download do pacote `.zip` da plataforma externa de inteligência artificial contendo arquivos nomeados padronizadamente:

### Mapeamento e Renomeação de Arquivos
A plataforma entrega os arquivos extraídos no formato:
`[NomeOriginal]-<stem>-<tonalidade>-<bpm>-<frequencia>.mp3`

O extrator realiza a leitura física deste ZIP, decodifica a tag `<stem>`, renomeia cada arquivo isolado e salva-o estruturadamente:
* **Exemplo**: `02 - Vestido Curto-drums-D minor-150bpm-441hz.mp3` é decodificado, renomeado para **`Bateria.mp3`**, e salvo sob a pasta dedicada no servidor `/downloads/tracks/[TrackId]/Bateria.mp3`.
* **Persistência Relacional**: As URLs de streaming físicas (ex: `/tracks/[TrackId]/Bateria.mp3`) de cada faixa descompactada com sucesso são registradas na tabela `"Stems"`, marcando a música como `Pronto`.

### Resiliência na Localização de Elementos Assíncronos
Durante a execução do bot headless, latências de renderização de Single Page Applications ou atrasos na carga de recursos externos podem fazer com que elementos HTML dinâmicos não estejam prontos de imediato. Para mitigar isso, o bot envelopa a localização dos frames em loops de retry:
* **Upload Frame**: Busca repetida com tolerância de até 10 segundos para encontrar o frame ativo de upload (`GetActiveUploadFrameAsync`).
* **Player DAW Frame**: Busca repetida com tolerância de até 15 segundos para encontrar o frame da mesa de mixagem (`GetActivePlayerFrameAsync`).
Isso protege a automação contra timeouts prematuros de renderização.

### Estratégia de Sincronização e Mitigação via Recarregamento (F5)
Executar uma DAW complexa em contêineres sem aceleração gráfica física expõe o navegador headless a limitações de processamento de áudio (AudioContext) e renderização WebGL. A mitigação é feita via recarregamento de página:
1. **Ignorar Decodificação em Tempo Real**: Forçar um recarregamento de página (F5) após o tempo de processamento no servidor permite que a interface da DAW recupere o estado compilado direto do banco de dados parceiro. Isso expõe diretamente o botão "Export" ativo e ignora a necessidade de carregar, decodificar ou reproduzir streams de áudio localmente, o que costuma causar quebras.
2. **Buffer de Segurança Pós-F5**: A automação aplica um tempo de espera estático de 30 segundos após o F5. Esse período garante a reconstrução completa do DOM e inicialização estável da página do player headless antes de prosseguir com a exportação.

---

## 3. Presets de Mixagem e UX Persistente

* **Player Headless Persistente (Estilo Spotify)**: A interface do frontend é construída como um Single Page Application (SPA). O player de áudio sincronizado reside no rodapé do layout global. Quando o usuário navega entre as páginas (Explorar, Minha Biblioteca, Configurações), o áudio **nunca é interrompido** e o estado da mixagem permanece intacto.
* **Presets Compartilhados**: Um usuário pode criar e salvar uma "Mixagem" de uma música (ex: mix "Voz + Piano" onde a bateria e o baixo estão zerados). Este preset é salvo na API e pode ser compartilhado com outros usuários através de links únicos, permitindo que diferentes ouvintes escutem versões customizadas da mesma obra.

---

## 4. Reordenação de Playlists (Drag-and-Drop) e Validação de Plays (Audiência)

### A. Sequenciamento Customizado via Arraste (Drag-and-Drop)
- **Segurança e Privilégios**: As ações de arrastar e reordenar a listagem de faixas nas playlists são ativadas exclusivamente para usuários autorizados (Dono da Playlist, Colaboradores Convidados ou Administradores). Para ouvintes comuns, o layout é renderizado como uma listagem estática e limpa (sem gatilhos e sem cadeados obstrutivos de interface).
- **Mecânica Visual Premium**: O arraste utiliza as propriedades HTML5 Drag-and-Drop nativas, oferecendo cursor de agarrar (`cursor-grab`) e linha indicadora visual de inserção na cor verde (`border-t-2 border-brand-green`) sobre o alvo.
- **Persistência Transacional (Optimistic UI)**: Quando o arraste termina (drop), a listagem local sofre um rearranjo otimista instantâneo, e em segundo plano é enviada uma requisição `PUT /api/Playlists/{id}/Reorder` contendo a payload do novo sequenciamento de IDs `{ TrackIds }`.

### B. Algoritmo de Validação e Rate-Limit de Audiência (Plays)
Para assegurar a integridade dos contadores de execuções (`PlayCount`) e prevenir spams baseados em cliques sequenciais, estruturamos uma proteção em duas barreiras:
1. **Frontend (Limiar de Escuta)**: O Player possui um acumulador em tempo de execução (`listeningAccumulatorRef`). O disparo para registrar a reprodução (`POST /api/Tracks/{id}/RecordPlay`) é inibido na inicialização da faixa e só é executado quando o usuário escuta de forma acumulativa 30 segundos (ou 50% de músicas curtas).
2. **Backend (Janela de Cooldown)**: Ao receber a requisição, o servidor identifica o cliente pelo `UserId` (se logado) ou `RemoteIpAddress` (se anônimo) e valida o play contra o `IMemoryCache`:
   - **Tracks**: O cooldown dura `Math.Max(track.Duration - 5, 30)` segundos.
   - **Playlists/Álbuns**: O cooldown dura 5 minutos.
   Se a chamada ocorrer dentro da janela de cooldown do respectivo usuário/IP para aquela entidade, ela é ignorada silenciosamente (sem incrementar o contador do banco).

---

## 5. Edição e Exclusão Física de Faixas em Qualquer Estado

Para permitir o controle total do ciclo de vida das faixas no ecossistema Mixer8, a aplicação permite a edição e exclusão de qualquer música da biblioteca, independentemente de seu status de extração (`Aguardando`, `Processando`, `Falhou`, `Pronto`).

- **Edição de Metadados**: A edição de metadados (como título e nome do artista) é permitida para qualquer música. No frontend, o modal de edição é resiliente e lida de forma segura caso a faixa ainda não tenha stems processadas.
- **Exclusão Completa**: A exclusão definitiva de uma faixa remove todos os registros associados no banco de dados e limpa os diretórios de stems em disco, evitando dados órfãos ou arquivos temporários não utilizados.
- **Restrição de Playlist**: Faixas que não estão prontas (ou que falharam no processamento de stems) não exibem a opção "Adicionar à playlist" no menu de contexto, prevenindo quebras e erros no reprodutor de áudio multi-stem.

