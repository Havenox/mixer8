# 008 - [Playlist/Admin]: Exclusão Completa e Limpa de Músicas do Sistema pelo Administrador

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Implementar a remoção completa de faixas musicais do ecossistema Mixer8, garantindo que a exclusão não deixe resíduos no banco de dados nem no armazenamento de disco. 
A deleção necessita de garantias transacionais rígidas para remover o registro da música, apagar em cascata suas stems e as associações em playlists dos usuários, bem como limpar fisicamente as stems (arquivos de áudio `.opus`), imagem de capa (`cover.jpg`) e diretório correspondentes no servidor.
No frontend, a funcionalidade deve ser exclusiva para administradores, acionada pelo menu de contexto de faixas com um modal de confirmação destrutivo que obriga o usuário a aguardar 3 segundos antes de confirmar.

---

## 🧠 Estratégia da Solução
1. **Transação ACID no Backend**:
   - Implementado um endpoint `DELETE /api/Tracks/{id}` restrito a administradores.
   - Utilizado `BeginTransactionAsync()` para agrupar as alterações de estado. Ao deletar a faixa, a exclusão lógica em cascata do EF Core limpa as entidades associadas de `Stems` e `PlaylistTracks`.
   - Após a gravação das alterações no PostgreSQL, remove-se fisicamente a pasta de stems (`wwwroot/stems/{id}`) e quaisquer arquivos temporários de upload no diretório de downloads. Em caso de erro em qualquer etapa física ou lógica, a transação é revertida com `RollbackAsync()`.
2. **Player Concurrente e Limpeza de Estado**:
   - Ajustada a assinatura de `loadTrack` no `PlayerContext.tsx` para aceitar `null`. Se a faixa sendo excluída for a que está ativa na mesa de som, o player interrompe a reprodução imediatamente e limpa a interface de áudio.
3. **Modal Destrutivo com Contagem Regressiva**:
   - Criados modais destrutivos com timer em `App.tsx` e `Dashboard.tsx`.
   - Quando o administrador seleciona "Excluir do Sistema", inicia-se um timer reativo local de 3 segundos que mantém o botão de confirmação desativado para evitar cliques acidentais e reforçar a seriedade da ação destrutiva.

---

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- **Controlador**: [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)
  - Adicionado endpoint `DELETE /api/Tracks/{id}` com atributo `[Authorize(Roles = "Admin")]`.
  - Tratamento transacional com rollback automático em caso de exceções no banco ou falhas de exclusão no sistema de arquivos.

### Frontend (React SPA)
- **Player**: [PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx)
  - Atualizada a assinatura e implementação de `loadTrack` para gerenciar carregamento de valor nulo de forma limpa.
- **Telas**: [App.tsx](file:///g:/DEV/mixer8/mixer8-app/src/App.tsx) e [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx)
  - Incluída a opção "Excluir do Sistema" condicionada ao papel `Admin`.
  - Desenvolvido modal local sob medida com contagem regressiva de 3s e validações de progresso e tratamento de erro de rede.

---

## 🎯 Impacto e Resultado
* **Armazenamento Otimizado**: A exclusão física completa garante que o espaço em disco do servidor de homelab seja liberado imediatamente, sem arquivos órfãos.
* **Integridade Referencial**: Relações em cascata limpam instantaneamente as faixas deletadas de todas as playlists públicas ou privadas, evitando quebras de carregamento.
* **Segurança UX**: O atraso de 3 segundos no botão de confirmação cria um "atrito positivo", eliminando exclusões indesejadas por erro de clique do operador.
