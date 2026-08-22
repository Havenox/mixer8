# 083 - Frontend: Exibição da Tonalidade (Key) Antes do Título em Playlists e Biblioteca

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 22/08/2026

---

## 🚀 Desafio de Engenharia
Na experiência do ecossistema Mixer8, músicos e produtores necessitam identificar instantaneamente o tom/tonalidade principal das músicas de seus repertórios antes de iniciar a execução. Anteriormente, o tom só se tornava visível após o usuário disparar a reprodução (no cabeçalho superior ou no footer player). Ao navegar por uma playlist ou pela biblioteca de músicas, não havia um indicativo visual estático do tom cadastrado/calculado na coluna `Key` da tabela de faixas, forçando o usuário a reproduzir a faixa ou inspecioná-la para saber sua tonalidade.

## 🧠 Estratégia da Solução
Aproveitando que o backend em .NET 10 já calculava e entregava a propriedade `Key` em PascalCase tanto nos endpoints de detalhes de playlist (`GET /api/Playlists/{id}` e `GET /api/Playlists/{id}/Tracks`) quanto de listagem de músicas (`GET /api/Tracks`):
1. **Design System Harmônico:** Foi desenhado um badge de tom cirúrgico e elegante baseado no protocolo `frontend-design`, com tipografia monoespaçada (`font-mono`), fundo translúcido `bg-brand-green/10`, texto em verde neon `text-brand-green`, borda suave de 1px `border-brand-green/30` e cantos arredondados, evitando ruídos visuais e preservando o contraste e o alinhamento.
2. **Posicionamento Estratégico:** O badge de tom foi posicionado imediatamente antes do título da música (`TrackTitle`), à esquerda, permitindo leitura visual natural e imediata tanto no Desktop quanto no Mobile.
3. **Abrangência Completa:** A exibição foi estendida aos layouts de Tabela Desktop e Lista Mobile de [PlaylistDetail.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/PlaylistDetail.tsx), bem como às visualizações de Lista Desktop, Lista Mobile e Grade (cards) de [TrackListing.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/TrackListing.tsx).
4. **Propagação de Metadados:** Padronizou-se a propagação das propriedades `Bpm` e `Key` nos handlers de carregamento e enfileiramento de faixas no clique mobile de playlists.

## 🛠️ Implementação Técnica
* **Frontend (`mixer8-app`):**
  * `src/pages/PlaylistDetail.tsx`: Adicionado badge condicional `{t.Key && (...)}` imediatamente antes de `{t.TrackTitle}` nos modos Desktop e Mobile. Corrigida a inclusão de `Bpm` e `Key` nos objetos `trackToPlay` e `tracksQueue` da visão mobile.
  * `src/components/TrackListing.tsx`: Adicionado badge condicional `{track.Key && (...)}` antes de `{track.TrackTitle}` nos três modos de renderização (Lista Desktop, Lista Mobile e Grade de Cards).
* **Validações e Testes:**
  * Compilação TypeScript e empacotamento Vite validados com sucesso (`npm run build`).
  * Atualização e reconstrução de containers validadas via `docker compose up -d --build`.

## 🎯 Impacto e Resultado
* **Visibilidade Imediata:** Músicos e DJs agora identificam de imediato o tom de qualquer música ao abrir uma playlist ou realizar buscas na biblioteca, sem a obrigatoriedade de dar play.
* **Consistência Cross-Platform:** A visualização mantém perfeita legibilidade e alinhamento responsivo em telas grandes (tabelas) e dispositivos móveis (listas verticais e cards).

---
**Nota do Desenvolvedor:** *A exposição proativa de metadados harmônicos críticos (como a tonalidade da faixa) diretamente nas listagens simplifica a tomada de decisão no palco e no estúdio, transformando a biblioteca e os repertórios em ferramentas de consulta rápida de alta precisão.*
