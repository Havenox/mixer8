# 029 - Biblioteca: Controle de Privacidade e Visibilidade para Músicas e Álbuns

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
A plataforma Mixer8 permitia apenas playlists com visibilidade customizada (Públicas, Privadas ou Não Listadas), enquanto as faixas e stems sempre permaneciam públicas e visíveis globalmente. Para aprimorar o controle de direitos, personalização e proteção do material autoral dos usuários, tornou-se crítico implementar níveis granulares de privacidade também para as músicas (`Track`) e álbuns (`Album`). O principal desafio foi garantir que músicas não-públicas fossem ocultadas de buscas e listagens gerais, mantendo regras estritas de acesso dinâmico quando essas faixas fossem inseridas em playlists com visibilidades diversas.

## 🧠 Estratégia da Solução
A abordagem de segurança seguiu uma lógica descentralizada entre consultas globais e visibilidade contextual dentro de coleções:
1. **Banco de Dados**: Criação de novas colunas no PostgreSQL com valores padrão seguros (`Public`) e auto-reparo para registros históricos legados.
2. **Listagens Gerais (`TracksController.GetAll`)**: Filtragem baseada em claims JWT do usuário conectado. Apenas músicas públicas ou músicas enviadas pelo próprio usuário (uploader) são retornadas (administradores têm passe livre para moderação).
3. **Coleções Contextuais (`PlaylistsController.GetPlaylistById`)**: Validação de visibilidade refinada por faixa usando uma máquina de estado simples:
   - Faixas públicas são irrestritas.
   - Faixas privadas (`Private`) só aparecem nas playlists para o próprio uploader da faixa.
   - Faixas não listadas (`Unlisted`) só aparecem para o uploader, o dono da playlist e colaboradores autorizados da playlist.
4. **Alinhamento do Contador de Músicas**: Atualização da contagem de faixas das playlists (`TracksCount`) para refletir dinamicamente a quantidade de faixas visíveis ao usuário logado, evitando inconsistências.
5. **Aparência Visual e Tooltips**: Exibição de selos visuais com tooltips flutuantes (chat bubbles) nas linhas de faixas e no grid da biblioteca, explicando de forma clara e contextual por que aquela música tem acesso restrito.

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- Adicionado campo `Visibility` às entidades de domínio `Track` e `Album` (com valor padrão `"Public"`).
- Criada e executada migração do Entity Framework Core `AddVisibilityToTrackAndAlbum`.
- Adicionado auto-reparo na inicialização do serviço (`Program.cs`) para converter valores vazios/nulos herdados de faixas e álbuns legados em `"Public"`.
- Modificados `TracksController.cs` e `PlaylistsController.cs` para implementar as validações de claims JWT e o método de visibilidade `IsTrackVisible`.
- Adicionadas propriedades de visibilidade ao `PlaylistTrackResponseDto` para consumo no frontend.

### Frontend (React SPA)
- Atualizadas as interfaces `ITrack` e `IPlaylistTrack` com os metadados de privacidade.
- Integrado o select dropdown para alteração de visibilidade no modal administrativo de edição de faixas em `Dashboard.tsx` e `App.tsx`.
- Renderizada tag visual refinada (`Não Listada` / `Privada`) nas tabelas, cards e mobile view com o ícone de informação e tooltip explicativo correspondente.

## 🎯 Impacto e Resultado
* **Segurança de Mídia Confiável**: Proteção rígida do material autoral contra vazamento em listagens gerais.
* **Comportamento Consistente de Playlists**: Visualização dinâmica e transparente de músicas restritas compartilhadas em playlists colaborativas ou públicas.
* **UX Premium e Informativa**: Tooltips e selos com micro-interações que educam o usuário sobre as regras de compartilhamento.

---
**Nota do Desenvolvedor:** *A implementação de regras contextuais complexas, como visibilidade de músicas dentro de playlists alheias, exige alta coesão e baixo acoplamento nas consultas SQL. Utilizar métodos auxiliares bem tipados e seguros para filtrar os DTOs no controller da API simplifica o modelo de dados e blinda as regras contra falhas humanas de bypass.*
