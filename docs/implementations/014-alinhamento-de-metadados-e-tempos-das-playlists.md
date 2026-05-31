# 014 - [Playlist]: Alinhamento de Metadados, Tempo Total e Avatar do Proprietário

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Na exibição dos cards de playlists na biblioteca e na tela de detalhes de cada playlist, identificaram-se desalinhamentos sutis nos elementos de metadados (como total de faixas e status de privacidade). Além de comprometer a estética premium da interface, faltavam informações úteis de tempo total aproximado de reprodução da playlist (soma da duração de todas as faixas). Havia também a necessidade de ocultar o e-mail cru do proprietário, substituindo-o por um nome amigável e um avatar de perfil placeholder, emulando fielmente o comportamento de alto nível do Spotify.

---

## 🧠 Estratégia da Solução
1. **Alinhamento Pixel Perfect (CSS Flexbox)**: Ajustamos todos os metadados e separadores para utilizarem alinhamento vertical flexbox estrito (`items-center`) com alturas de linha uniformes. Dimensionamos os ícones de Lucide de maneira padrão e controlada (`shrink-0` e dimensões iguais de `w-3.5 h-3.5`).
2. **Cálculo Determinístico de Tempo**: Criamos algoritmos para somar a duração individual das faixas a partir de seus hashes estáveis de `TrackId`, formatando o resultado de acordo com a duração total (usando minutos se for menor que 1 hora e horas/minutos caso ultrapasse).
3. **Avatar de Perfil e Nome Amigável**: Desenvolvemos um helper para extrair e capitalizar o nome de usuário a partir do e-mail de registro (ex: `admin@mixer8.com` vira `Admin`), exibindo-o ao lado de um avatar circular contendo a primeira letra do nome.

---

## 🛠️ Implementação Técnica

### Frontend (React SPA)

#### Listagem de Playlists (`Playlists.tsx`)
- Implementada a função auxiliar `getPlaylistTotalDuration` para calcular deterministamente a duração total de todas as faixas da playlist.
- Reestruturado o rodapé de metadados dos cards com CSS Flexbox (`items-center mt-1 select-none flex-wrap leading-none text-xs gap-1.5 text-brand-gray`).
- Adicionado o tempo total aproximado com o ícone de relógio `Clock`.
- Padronizados os tamanhos dos ícones de privacidade (`Lock`, `Globe`, `EyeOff`) em `w-3.5 h-3.5`.

#### Detalhes de Playlist (`PlaylistDetail.tsx`)
- Implementadas as funções `getMockDurationSeconds`, `getPlaylistTotalDurationString` e `getOwnerDisplayName`.
- Reestruturada a linha de metadados do cabeçalho abaixo do nome da playlist para conter:
  1. O avatar do dono (círculo com a inicial capitalizada com `w-5 h-5 rounded-full bg-brand-green text-black font-black text-[10px] uppercase shadow-sm select-none`).
  2. O nome amigável de exibição (`Admin`, `Moderator`, etc.) em negrito.
  3. A quantidade exata de músicas e a duração total formatada com o ícone de relógio `Clock`.
  4. O status de privacidade (Privada, Pública, Não Listada) com seu ícone correspondente alinhado de forma cirúrgica.

---

## 🎯 Impacto e Resultado
* **Visual Premium e Alinhado**: Todas as informações e separadores do cabeçalho e dos cards estão perfeitamente alinhados no mesmo eixo horizontal (pixel perfect).
* **Avatar e Nome Amigável**: Melhoria drástica de UX ao ocultar e-mails brutos de sistema em favor de nomes e iniciais limpas.
* **Duração Total Transparente**: Usuários podem ver instantaneamente o tempo total de audição estimado da playlist antes de começar a ouvi-la.

---
**Nota do Desenvolvedor:** *O cuidado com pequenos desalinhamentos de fontes e ícones é o que separa um design genérico de um visual verdadeiramente profissional e cativante. O uso sistemático do flexbox de eixo central garante a longevidade visual da marca.*
