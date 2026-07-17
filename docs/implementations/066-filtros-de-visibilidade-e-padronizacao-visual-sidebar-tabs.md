# 066 - UI/UX & API: Filtros de Visibilidade Avançados, Persistência Local e Padronização da Barra Lateral

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 17/07/2026

---

## 🚀 Desafio de Engenharia
O sistema anterior do Mixer8 utilizava um modelo de filtragem binário simples (Públicas vs Todas) controlado pela variável `showAll`. Com a introdução de novos tipos de visibilidade para faixas e playlists ("Private" e "Unlisted"), o alternador antigo tornou-se insuficiente. Além disso, a falta de persistência local da seleção forçava o usuário a reconfigurar seus filtros a cada transição de tela. 

No âmbito visual, havia inconsistências no dimensionamento de textos na barra lateral, onde elementos inferiores tinham fontes maiores do que os menus principais. No mobile, a falta de divisores claros no menu superior e o excesso de texto no menu de abas do Painel de Controle prejudicavam a ergonomia e poluíam a tela em dispositivos de baixa resolução.

## 🧠 Estratégia da Solução
1. **Modelagem de API & Backend**: Estender o endpoint `/api/Tracks` para aceitar um parâmetro opcional de filtragem por visibilidade (`visibility`), permitindo buscas refinadas direto no banco de dados e mantendo a paginação correta em vez de efetuar filtragens pós-busca ineficientes no cliente.
2. **Persistência Individualizada no Frontend**: Substituir o botão binário por uma barra de filtros de chips contendo as opções (Públicas, Todas, Privadas, Não-Listadas) e sincronizar a seleção ativa via `localStorage` de forma isolada para cada categoria de listagem (ex: `mixer8_visibility_filter_library` para a biblioteca de faixas, `mixer8_visibility_filter_playlists` para as playlists). Dessa forma, a preferência de cada contexto é preservada individualmente sem interferir nos demais.
3. **Refinamento de UI/UX Responsivo**:
   - Padronizar toda a tipografia da barra lateral com tamanho consistente (`text-sm` e `font-semibold`).
   - Introduzir um divisor vertical físico (`w-[1px]`) no header superior do mobile para segmentar visualmente os atalhos de exploração (Home, Biblioteca, Playlists) das ações de gestão (Upload, Admin).
   - Ocultar textos e deixar apenas ícones representativos com dicas flutuantes (`title`) para as abas do Painel de Controle do Admin em telas pequenas (`< sm`).

## 🛠️ Implementação Técnica

### Backend
- **[TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)**:
  - Adicionado o parâmetro opcional `[FromQuery] string? visibility = null` no método `GetAll`.
  - Inserida cláusula LINQ para filtrar resultados com `query = query.Where(t => t.Visibility == visibility)` mantendo a validação prévia de permissões de acesso já existentes no banco de dados.

### Frontend
- **[Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx)**:
  - Alterado o estado de filtragem para suportar `'all' | 'public' | 'private' | 'unlisted'`, inicializando a partir do `localStorage` com a chave individualizada `mixer8_visibility_filter_library`.
  - Ajustado o método `fetchTracks` para repassar tanto a flag `showAll` correta quanto o parâmetro `visibility` mapeado para a API.
  - Implementado os botões de chips de filtro integrando a nova interface e persistindo a seleção.
  - Corrigido o bloco de renderização `TrackListing` restaurando o design padrão.
- **[Playlists.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Playlists.tsx)**:
  - Implementada a mesma lógica de chips e sincronização com o `localStorage` sob a chave individualizada `mixer8_visibility_filter_playlists`.
  - Ajustada a lógica de filtragem cliente-side de playlists para respeitar as novas opções de visibilidade de forma reativa.
- **[PersistentLayout.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/PersistentLayout.tsx)**:
  - Aplicada a classe `text-sm` em todos os botões e links de navegação da barra lateral.
  - Adicionada uma barra divisória vertical no cabeçalho superior mobile posicionada estrategicamente antes do ícone de upload.
- **[Admin.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Admin.tsx)**:
  - Adicionado `hidden sm:inline` nos rótulos de texto das abas de configurações, logs e usuários, transformando as abas em ícones puros em telas móveis com suporte a tooltips `title` acessíveis.

## 🎯 Impacto e Resultado
* **Consistência de Estado**: A preferência de visualização do usuário agora é mantida intacta mesmo se ele navegar para outras telas do sistema ou atualizar a página.
* **Ergonomia e Design Consistente**: Sidebar PC harmonizada e interface mobile mais limpa, reduzindo a poluição cognitiva com ícones otimizados e divisores apropriados.
* **Flexibilidade de Privacidade**: Suporte nativo completo a faixas e playlists marcadas como "Privadas" ou "Não-Listadas", garantindo a privacidade das criações dos usuários.

---
**Nota do Desenvolvedor:** *A persistência local de estados de preferência como filtros e modos de exibição transforma drasticamente a experiência percebida de fluidez na aplicação. Manter a coerência visual entre mobile e desktop usando classes utilitárias adaptativas do Tailwind (como `hidden sm:inline`) evita a duplicação desnecessária de código e mantém o bundle final enxuto.*
