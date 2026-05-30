# Lógica de Domínio e Experiência do Usuário (ADR-02)

Este documento descreve as joias da coroa do **Mixer8**: a lógica de sincronização do player de áudio multi-stem e o fluxo de extração headless automatizado.

---

## 1. O Core Player: Sincronização de Múltiplas Stems

Ao contrário de tocadores de música tradicionais que reproduzem um único stream de áudio, o player do **Mixer8** reproduz simultaneamente até 5 faixas separadas (Voz, Baixo, Bateria, Teclado/Piano e Outros) correspondentes a uma única música.

### A Mecânica de Sincronização Sólida
Para garantir que as faixas não percam o sincronismo de tempo (drift) durante a reprodução no navegador, o frontend `mixer8-web` implementa a seguinte arquitetura de áudio:

```
                      ┌──────────────────────┐
                      │    Master Clock      │  <-- Relógio central da DAW
                      └──────────┬───────────┘
                                 │ Sincroniza Play/Pause/Seek
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
 ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
 │ Stem: Vocals │         │  Stem: Bass  │         │ Stem: Drums  │ ...
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

1. **Web Audio API**: O player utiliza a `Web Audio API` nativa do navegador em vez de múltiplos elementos `<audio>` simples.
2. **Master Clock**: Um relógio central serve como âncora absoluta. Quando o usuário executa um *Seek* (pula para outra parte da música), o tempo de reprodução de todas as instâncias `AudioBufferSourceNode` é reconfigurado de forma atômica no mesmo milissegundo.
3. **GainNodes Individuais**: Cada stem passa por seu respectivo nó de ganho (`GainNode`), o qual é controlado em tempo real pelos sliders de volume da DAW na interface do usuário. Isso permite mixar a música dinamicamente na hora, silenciar faixas (ex: isolar a voz ou remover a bateria) e salvar estes níveis como presets de mixagem personalizados do usuário.

---

## 2. O Fluxo de Extração Inteligente (Moises Integration)

A jornada de criação de uma música com stems no Mixer8 se inicia no upload de um arquivo de áudio estéreo convencional. O microserviço `moises-extractor` faz a mágica de conversão se comportando como um bot headless:

```
[Usuário] 
   │ 1. Faz upload do MP3 de 1 arquivo estéreo
   ▼
[mixer8-api] 
   │ 2. Salva arquivo no storage temporário
   │ 3. Cria registro da track com status "Aguardando Extração"
   ▼
[moises-extractor] (C# Playwright Worker)
   │ 4. Detecta nova tarefa pendente
   │ 5. Inicializa o Chromium Headless com cookies de sessão de "auth.json"
   │ 6. Navega para Moises.ai, faz upload e seleciona a opção "5 Stems"
   │ 7. Aguarda em polling visual na biblioteca até a faixa constar como processada
   │ 8. Acessa o player do Moises, abre o menu "Exportar" e baixa o pacote ZIP
   │ 9. Descompacta o arquivo ZIP contendo as 5 faixas individuais
   ▼
[mixer8-api]
   │ 10. Atualiza registro no banco vinculando as URLs de cada uma das 5 stems
   │ 11. Notifica o frontend (via Webhook ou WebSocket) que a música está pronta
   ▼
[mixer8-web]
   │ 12. Disponibiliza a track com os sliders da DAW ativos no player do usuário!
```

---

## 3. Presets de Mixagem e UX Persistente

* **Player Headless Persistente (Estilo Spotify)**: A interface do frontend é construída como um Single Page Application (SPA). O player de áudio sincronizado reside no rodapé do layout global. Quando o usuário navega entre as páginas (Explorar, Minha Biblioteca, Configurações), o áudio **nunca é interrompido** e o estado da mixagem permanece intacto.
* **Presets Compartilhados**: Um usuário pode criar e salvar uma "Mixagem" de uma música (ex: mix "Voz + Piano" onde a bateria e o baixo estão zerados). Este preset é salvo na API e pode ser compartilhado com outros usuários através de links únicos, permitindo que diferentes ouvintes escutem versões customizadas da mesma obra.
