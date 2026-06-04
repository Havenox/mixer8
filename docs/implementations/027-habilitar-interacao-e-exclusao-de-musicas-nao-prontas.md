# 027 - [Biblioteca / Admin]: Habilitar Interação e Exclusão de Músicas não Prontas ou com Falha

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 03/06/2026

---

## 🚀 Desafio de Engenharia
Até então, o Mixer8 restringia o menu de contexto na tela de biblioteca/dashboard (`Dashboard.tsx`) apenas para faixas musicais com status `Pronto` (ou seja, cuja extração/processamento de stems havia sido concluída com sucesso). 
Isso causava dois grandes inconvenientes:
1. Usuários e administradores não conseguiam interagir com músicas que estavam na fila de espera (`Aguardando`), em processamento (`Processando...`) ou que falharam (`Falhou`).
2. Quando uma música falhava ou ficava travada, não era possível excluí-la fisicamente do sistema ou editá-la, deixando registros órfãos no banco de dados e arquivos residuais ou capas sem possibilidade de remoção pela UI.
3. Ao clicar com o botão direito sobre essas músicas que não estavam com status `Pronto`, o navegador abria o menu de contexto padrão do sistema operacional, poluindo a experiência de uso.

## 🧠 Estratégia da Solução
1. **Menu de Contexto Irrestrito**:
   - Ajustado o manipulador `onContextMenu` no card de música em `Dashboard.tsx` para interceptar e prevenir o comportamento padrão do navegador (`preventDefault()`) para todas as músicas, independente de seu status.
   - Habilitado a exibição do menu de contexto personalizado do Mixer8 para qualquer status de faixa (`Aguardando`, `Processando`, `Falhou`, `Pronto`).
2. **Condicionamento de Opções Exclusivas**:
   - Músicas que não estão prontas não devem ser adicionadas a playlists (já que não possuem stems para streaming). Portanto, a opção "Adicionar à playlist" no menu de contexto foi condicionada para ser exibida apenas se o status da faixa for estritamente `Pronto`.
   - O divisor administrativo (`<div className="h-[1px] bg-brand-hover my-1" />`) também foi condicionado para aparecer somente se a opção de playlist estiver presente, garantindo a estética visual limpa.
3. **Cascatas Transacionais no Backend**:
   - Confirmado que o endpoint `DELETE /api/Tracks/{id}` já possuía resiliência e isolamento transacional ACID. Ele remove com segurança a faixa, seus registros de stems associados (mesmo se vazios/ausentes), as referências em playlists do banco e limpa fisicamente o diretório de stems (`wwwroot/stems/{id}`) e imagens de capa, funcionando perfeitamente para músicas em qualquer estado.

## 🛠️ Implementação Técnica

### Frontend (React SPA)
* **Telas**: [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx)
  - Removida a restrição `track.ExtractionStatus === 'Pronto'` de dentro de `onContextMenu`.
  - Envelopada a renderização do botão "Adicionar à playlist" e do divisor de linha adjacente sob a checagem `contextMenu.track.ExtractionStatus === 'Pronto'`.

---

## 🎯 Impacto e Resultado
* **Gerenciamento Completo de Falhas**: Administradores agora conseguem limpar faixas que falharam no extrator com um clique, liberando instantaneamente espaço em disco e mantendo a integridade referencial do banco de dados.
* **UX Consistente**: Fim do comportamento do menu padrão do Windows sendo aberto ao clicar com o botão direito nas músicas não prontas.
* **Segurança na Operação**: Impedimento de inclusão de faixas sem stems em playlists de reprodução, evitando quebras no player.

---
**Nota do Desenvolvedor:** *A exclusão no backend já era robusta o suficiente para lidar com faixas sem stems ou com stems parciais (através de transações e exclusão de diretórios condicional), de modo que apenas a liberação do menu de contexto no frontend foi necessária para fechar o ciclo de vida dessas faixas.*
