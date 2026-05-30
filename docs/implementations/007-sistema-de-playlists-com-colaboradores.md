# 007 - [Playlist/Colaboradores]: Sistema Completo de Playlists com Gerenciamento de Colaboradores e Controle de Privacidade

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Implementar a funcionalidade de "Playlists" permitindo que usuários criem listas de reprodução personalizadas (Públicas, Privadas ou Não Listadas). As playlists precisavam permitir a colaboração multiusuário (proprietários podem convidar outros membros por e-mail, e estes podem adicionar ou remover as faixas que eles mesmos adicionaram).
No frontend, o layout deveria ser refinado seguindo a identidade visual premium do Spotify, herdando a capa da playlist dinamicamente da primeira faixa (se não houver uma capa customizada), fornecendo integração de clique com o botão direito nas tabelas/cards do Dashboard e da página Explorar para adicionar músicas a playlists, e controle total de tocabilidade global integrado.

---

## 🧠 Estratégia da Solução
1. **Modelagem de Domínio com EF Core**:
   - Criação da entidade `Playlist` com suporte a visibilidade (`Public`, `Private`, `Unlisted`).
   - Tabela de junção `PlaylistTrack` registrando a faixa, data de inserção e ID/E-mail do usuário que a adicionou.
   - Tabela de junção `PlaylistCollaborator` autorizando colaboradores externos a adicionar/remover faixas.
2. **Camada de Autenticação e Autorização na API**:
   - Validação rígida nos endpoints da API (.NET 10). Apenas proprietários/administradores podem editar configurações de visibilidade, deletar playlists ou gerenciar colaboradores.
   - Colaboradores têm acesso de escrita limitado (podem adicionar novas faixas e deletar apenas as faixas que eles mesmos contribuíram).
   - Playlists privadas só podem ser acessadas pelo dono e colaboradores cadastrados.
3. **Menu Lateral e Modais Integrados**:
   - Integração do carregamento de playlists do usuário no painel esquerdo (`PersistentLayout.tsx`) com atalho rápido de criação de playlists.
   - Modal global para gerenciar colaboradores por e-mail e modal de adição rápida que desativa faixas já adicionadas ("Já adicionado").
4. **Detalhes no Estilo Premium (Spotify-like)**:
   - Exibição de capa chamfrada, cabeçalho de gradiente dinâmico com blur sutil, e listagem em tabela de todas as faixas ordenadas pela ordem de inserção.
   - Integração das stems nas faixas retornadas pela API da playlist, permitindo play direto e sem drifts de latência via HTTP Range Requests (206) em cada canal.

---

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- **Modelos**: [Playlist.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/Playlist.cs), [PlaylistTrack.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/PlaylistTrack.cs), e [PlaylistCollaborator.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/PlaylistCollaborator.cs).
- **Relacionamentos**: Configurados em [Mixer8DbContext.cs](file:///g:/DEV/mixer8/mixer8-api/Infrastructure/Mixer8DbContext.cs) com deleção em cascata adequada.
- **Controlador**: [PlaylistsController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/PlaylistsController.cs) cobrindo CRUD, gerenciamento de faixas e verificação de colaboradores autorizados.

### Frontend (React SPA)
- **Estado Global**: [PlaylistContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlaylistContext.tsx) para gerenciar o estado das playlists de forma reativa e centralizada.
- **Menu Lateral**: [PersistentLayout.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/PersistentLayout.tsx) renderizando links diretos para `/playlists/:id`.
- **Menu de Contexto**: [App.tsx](file:///g:/DEV/mixer8/mixer8-app/src/App.tsx) e [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx) disparando o modal global de seleção de playlist ao clicar com o botão direito nos cards ou nas tabelas.
- **Tela de Playlist**: [PlaylistDetail.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/PlaylistDetail.tsx) para renderizar a interface e lidar com todas as operações locais e modais internos de ajustes.

---

## 🎯 Impacto e Resultado
* **Engajamento Social**: Usuários agora podem interagir diretamente colaborando em playlists públicas ou restritas.
* **UX Sem Costura**: O menu de contexto permite adicionar qualquer música de qualquer tela à playlist de forma instantânea sem quebras de navegação.
* **Integridade de Negócio**: Controles robustos de segurança no backend garantem que colaboradores não removam faixas de terceiros ou manipulem configurações restritas do proprietário.
