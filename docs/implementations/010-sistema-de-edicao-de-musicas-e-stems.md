# 010 - [Playlist/Admin]: Sistema Completo de Edição de Músicas e Gerenciamento de Stems

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Implementar a funcionalidade de edição e calibração de faixas musicais e seus canais de stems no sistema Mixer8, restrita a administradores. 
O desafio técnico envolvia:
- Atualização dinâmica e segura de metadados principais (Título, Artista) e imagem de capa (sobrescrevendo e removendo o arquivo anterior).
- Edição granular de stems: possibilidade de deletar stems individuais (banco e disco), substituir o arquivo de áudio de stems existentes mantendo a conformidade Opus/Mono (se aplicável), e adicionar novas stems avulsas ou ZIPs.
- Evitar colisões e cache no sistema de arquivos ao salvar ou substituir múltiplas stems do mesmo tipo, garantindo que o player global de mixagem reaja dinamicamente e recarregue a música editada de forma transparente caso ela estivesse ativa.

---

## 🧠 Estratégia da Solução
1. **API Transacional Robusta (PUT /api/Tracks/{id})**:
   - Desenvolvido o handler `PUT` contendo transação ACID.
   - Atualiza capa no disco se enviada, excluindo a anterior física.
   - Exclui fisicamente as stems solicitadas em `DeleteStemIds` e seus registros correspondentes.
   - Para substituições de stems (`ReplaceStem_{stemId}`), localiza-se o registro existente, deleta-se o arquivo antigo e realiza-se a conversão Opus/Mono sobre o mesmo ID de entidade. Novos nomes de arquivo no disco recebem hash exclusivo no formato `{stemType}_{guid}.opus` para blindar o sistema contra colisões e cache estático do navegador.
   - Processamento de novos ZIPs e áudios anexados, persistindo as chaves com FFmpeg.
2. **Player Concorrente Atualizado**:
   - No frontend, o callback de sucesso avalia se a música modificada é a que está ativamente carregada no `PlayerContext`. Em caso positivo, executa `loadTrack(updatedTrack)` reiniciando dinamicamente os buffers de mixagem com as novas stems de forma instantânea.
3. **Modal Administrativo Spotify-like**:
   - Inserida a opção "Editar Música" no menu de contexto (clique direito) condicionada a `UserRole === 'Admin'`.
   - Criado modal completo com preview de capa local, marcações visuais com feedback em tempo real para exclusões pendentes (riscado e vermelho) ou substituições (verde) e listagem de novos uploads de ZIPs ou áudios avulsos.

---

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- **Controlador**: [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)
  - Criado o DTO `UpdateTrackRequest` e o endpoint `PUT /api/Tracks/{id}` com o atributo `[Authorize(Roles = "Admin")]`.
  - Tratamento transacional com rollback automático.

### Frontend (React SPA)
- **Páginas**: [App.tsx](file:///g:/DEV/mixer8/mixer8-app/src/App.tsx) e [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx)
  - Integrados os estados de controle, preview de arquivos e manipulador `handleSaveEdit`.
  - Adicionado o modal rico e reativo ao final dos layouts e opção de clique direito.

---

## 🎯 Impacto e Resultado
* **Gerenciamento de Biblioteca Autônomo**: Administradores podem corrigir metadados e calibrar stems de forma 100% autônoma pela interface.
* **Segurança Referencial & Cache**: A geração de nomes físicos únicos impede colisões em stems redundantes e anula caches forçados do browser nas substituições de áudio.
* **UX Sem Costura**: O recarregamento imediato no tocador ativo garante que o mixer da DAW seja reconstruído dinamicamente sem forçar F5 na página.
