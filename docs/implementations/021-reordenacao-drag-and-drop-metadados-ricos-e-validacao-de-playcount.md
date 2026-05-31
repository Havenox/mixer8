# 021 - Biblioteca & Player: Reordenação Drag-and-Drop, Metadados Ricos e Validação de PlayCount

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
O Mixer8 necessitava de recursos fundamentais de metadados e controle de audiência comuns nas plataformas modernas de áudio. Isso incluía:
1. Extração automatizada e persistência da duração real de áudio das faixas de música no momento do upload.
2. Organização personalizada e sequenciamento de faixas de playlists via interação direta na interface com o mouse (Drag-and-Drop nativo), de forma restrita a criadores e colaboradores.
3. Rastreamento e contagem de audiência (Plays) de faixas, playlists e álbuns sem contagem ingênua baseada em cliques puros e livre de fraudes e botting.
4. Modelagem arquitetural para suportar entidades de Álbuns associados a múltiplas faixas.

## 🧠 Estratégia da Solução
Decidimos implementar uma arquitetura ponta a ponta com as seguintes regras de negócio e de performance:
- **Segurança de Reordenação e Sem Poluição Visual**: O recurso Drag-and-Drop na listagem é ativado e renderizado de forma estrita a usuários com permissão de edição (Dono/Colaborador/Admin), deixando a árvore DOM limpa e estática para usuários não autorizados.
- **Validação Anti-Fraude no Cliente (30 segundos)**: O player do Mixer8 monitora e acumula em tempo de execução os segundos líquidos ouvidos pelo usuário. A requisição de play só é emitida ao servidor ao cruzar o limiar de 30 segundos (ou 50% de músicas muito curtas).
- **Anti-Spam no Backend (IMemoryCache)**: No servidor, as requisições de contagem são associadas a chaves baseadas em `UserId` ou `IP Remoto`. É aplicado um cooldown deslizante no cache igual a `Math.Max(track.Duration - 5, 30)` segundos para faixas e de 5 minutos para playlists/álbuns.

## 🛠️ Implementação Técnica

### Backend (.NET 10 & EF Core)
- **Modelagem**: Adicionadas as colunas `Duration` e `PlayCount` na tabela `Tracks`, `PlayCount` em `Playlists`, `PlayCount` em `Albums`, e `Order` na tabela de junção `PlaylistTracks`.
- **Álbuns**: Criada a entidade `Album` e configurado o relacionamento One-to-Many com `Track` no `Mixer8DbContext` utilizando comportamento `OnDelete(DeleteBehavior.SetNull)` para evitar a deleção física de singles se o álbum associado for removido.
- **Extração com ffprobe**: Método estático de consulta via shell do utilitário `ffprobe` para ler e persistir dinamicamente a duração em segundos das faixas no upload.
- **Endpoint de Reordenação**: Implementada a rota `PUT /api/Playlists/{id}/Reorder` recebendo a lista ordenada de ids de músicas e gravando a sequência de forma transacional (ACID).
- **Endpoint de RecordPlay**: Rota `POST /api/Tracks/{id}/RecordPlay` protegida por rate-limiting usando cache em memória (`IMemoryCache`) e registrando plays de faixas e coleções sob chaves temporárias por IP/User.

### Frontend (React SPA)
- **Drag-and-Drop Nativo**: Atributo `draggable={canModifyPlaylist}` com callbacks nativos de arraste e linha indicadora de drop em verde (`border-t-2 border-brand-green`).
- **Atualização Otimista**: A ordenação da UI reage instantaneamente ao drop, disparando a chamada assíncrona da API em segundo plano para persistência definitiva.
- **Mapeamento de Contrato**: Interfaces TypeScript estritamente tipadas com grafia **PascalCase** (`Duration`, `Order`) oriundas da API soberana.
- **Temporizador de Audiência**: Adicionado acumulador de tempo real no `PlayerContext.tsx` que dispara de forma autônoma o registro de play após o limiar de escuta ser satisfeito.

## 🎯 Impacto e Resultado
* **Combate a Fraudes**: Proteção contra bots e cliques repetidos que inflam estatísticas do backend de forma artificial, reduzindo requisições indesejadas no servidor.
* **UX Premium**: Reorganização visual rápida, interativa e fluida de playlists, emulando perfeitamente a experiência de players de mercado como o Spotify.
* **Consistência de Metadados**: Duração correta das músicas exibida na interface em formato `m:ss` e soma dinâmica de tempo total de execução da playlist.

---
**Nota do Desenvolvedor:** *A estruturação do acumulador no estado global do player utilizando referências estáveis (`useRef`) mitigou perfeitamente renders indesejados da árvore React. O uso de `IMemoryCache` no servidor garantiu uma barreira de rate-limit leve e eficiente sem acrescentar dependências externas ou latência adicional no banco de dados principal.*
