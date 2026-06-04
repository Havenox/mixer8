# 032 - [Moderação]: Restauração de Músicas e Motivos de Exclusão

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
Até a implementação desta funcionalidade, quando um usuário de plano pago (uploader/PaidUser) solicitava a exclusão de uma faixa própria, a aplicação apenas acionava uma exclusão lógica (`DeletionPending = true`), ocultando a música de usuários comuns. O administrador via a música rotulada como `"Aguardando Exclusão"` no painel, mas as únicas ações eram a exclusão física definitiva em disco e banco. Faltavam duas engrenagens cruciais na moderação de conteúdo:
1. **Recuperabilidade (Restore)**: Capacidade do administrador reverter a solicitação e reativar a música caso a exclusão fosse negada ou decidida contra.
2. **Contexto da Solicitação (Justificativa)**: Falta de informações sobre a motivação por trás da solicitação de exclusão (como motivos autorais, judiciais ou técnicos), o que forçava o administrador a decidir sem dados de suporte.

## 🧠 Estratégia da Solução
Para endereçar o problema com robustez técnica e alinhamento de contrato (PascalCase), decidimos:
* **Persistência do Motivo**: Adicionar uma coluna de texto opcional `DeletionReason` diretamente na tabela `Tracks` (PostgreSQL), mantendo o ciclo de vida deste metadado atrelado temporariamente à música enquanto estiver sob moderação.
* **API de Moderação**:
  * Ajustar a rota de deleção lógica (`DELETE api/Tracks/{id}`) para receber um parâmetro de query string contendo a justificativa do uploader comum.
  * Criar um endpoint de restauração restrito (`POST api/Tracks/{id}/Restore`) que zera os dados de solicitação (`DeletionPending = false` e `DeletionReason = null`).
* **UX de Justificativa e Rótulo**:
  * Alterar o rótulo de moderação na UI de `"Aguardando Exclusão"` para `"Marcado pra Excluir"`.
  * Introduzir uma caixa de texto (`textarea`) no modal de confirmação do uploader para justificar a exclusão.
  * Exibir o ícone de informações (`Info`) ao lado da etiqueta de exclusão apenas para Administradores, que revela o motivo em um tooltip ao pairar o mouse.
  * Adicionar a opção `"Restaurar Música"` no menu de contexto (clique direito) para administradores.

## 🛠️ Implementação Técnica

### Backend (.NET 10 / C# 13)
* **Domain Model**: Modificada a classe [Track.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/Track.cs) adicionando a propriedade `DeletionReason`.
* **Database Migrations**: Gerada e aplicada a migração EF Core `AddDeletionReasonToTrack` para criar a coluna correspondente no banco.
* **Controllers**:
  * Atualizado o endpoint `Delete` em [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs) para ler `[FromQuery] string? reason`.
  * Criado o endpoint `Restore` restrito a administradores em [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs).

### Frontend (React SPA)
* **Player Context**: Atualizada a interface `ITrack` em [PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx).
* **Biblioteca & Dashboard**:
  * Adicionado estado `deletionReasonInput` e caixa de entrada no modal de confirmação no [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx).
  * Exibido tooltip premium com o motivo da exclusão e botão de contexto para restauração.
* **Playlists**:
  * Adaptado o componente [PlaylistDetail.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/PlaylistDetail.tsx) para suportar as mesmas lógicas de moderação e justificativas.

## 🎯 Impacto e Resultado
* **Moderação de Conteúdo Blindada**: Administradores agora possuem total poder para restaurar faixas ou confirmar a exclusão com base na justificativa do solicitante.
* **Fluxo de Trabalho Descomplicado**: As justificativas são informadas sem atritos diretamente no momento de apagar a música, e são apresentadas de forma concisa por hover de tooltips no painel.

---
**Nota do Desenvolvedor:** *A escolha de manter o DeletionReason na própria tabela de Tracks simplificou consideravelmente o modelo transacional. Ao aprovar a exclusão, a purga ocorre em lote transacional e limpa tudo fisicamente; ao rejeitar, a restauração limpa os metadados em uma única escrita assíncrona, eliminando a necessidade de gerenciar tabelas órfãs de logs de moderação.*
