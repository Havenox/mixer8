# 056 - [Search]: Busca Global Case e Accent-Insensitive na Biblioteca e Playlists

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
Usuários constantemente enfrentavam frustração ao tentar buscar músicas ou playlists na plataforma sem incluir acentuação diacrítica exata (como acentos agudos, circunflexos, tils ou cedilhas). O sistema de busca do PostgreSQL diferenciava caracteres acentuados de caracteres puros, exigindo digitação perfeita dos metadados (ex: buscar "musica" não retornava faixas cadastradas como "Música").

A busca precisava ser unificada, de alta performance e imune a acentos tanto nas consultas de banco de dados (biblioteca) quanto na filtragem em memória local (playlists).

## 🧠 Estratégia da Solução
*   **No Backend (Banco de Dados)**: Ativamos e utilizamos a extensão **`unaccent`** do PostgreSQL. Nas queries do Entity Framework Core, as strings de busca e os campos de texto do banco são processados por `EF.Functions.Unaccent` e comparados usando `EF.Functions.ILike` para ignorar maiúsculas/minúsculas.
*   **No Frontend (Em Memória)**: Criamos uma função de normalização de strings em JavaScript que decompõe caracteres unicode e remove diacríticos (acentos). As pesquisas locais de playlists na SPA utilizam esse helper para filtrar o estado em memória instantaneamente.

---

## 🛠️ Implementação Técnica

### 1. Backend API (Consulta de Músicas)
Modificado o método `GetAll` em [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs#L58-L66):
```csharp
if (!string.IsNullOrWhiteSpace(search))
{
    var searchPattern = $"%{search}%";
    query = query.Where(t => 
        EF.Functions.ILike(EF.Functions.Unaccent(t.TrackTitle), EF.Functions.Unaccent(searchPattern)) || 
        EF.Functions.ILike(EF.Functions.Unaccent(t.ArtistName), EF.Functions.Unaccent(searchPattern))
    );
}
```
*A extensão `unaccent` é instalada no PostgreSQL no startup da aplicação por meio de migrações que executam comandos SQL DDL nativos (`CREATE EXTENSION IF NOT EXISTS unaccent;`).*

### 2. Frontend SPA (Consulta de Playlists)
Adicionado helper de normalização no [Playlists.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Playlists.tsx#L29-L44):
```typescript
const normalizeText = (text: string) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Filtragem em tempo de execução
const filteredPlaylists = playlists.filter(p => {
  const query = normalizeText(searchInput);
  const matchesSearch = 
    normalizeText(p.Name).includes(query) ||
    (p.Description && normalizeText(p.Description).includes(query));

  const matchesVisibility = showAll ? true : p.Visibility === 'Public';
  return matchesSearch && matchesVisibility;
});
```

---

## 🎯 Impacto e Resultado
* **Busca Tolerante e Intuitiva**: Digitar "joao" localiza "João", "JOÃO", "joao" ou "jOãO".
* **Consistência de Busca**: O comportamento foi unificado tanto nas requisições HTTP paginadas de músicas (PostgreSQL) quanto nas listas locais de playlists (SPA client-side).
* **Performance**: A busca com `unaccent` no PostgreSQL opera de forma eficiente e sem sobrecarga no banco do homelab.

---
**Nota do Desenvolvedor:** *A normalização unicode em Javascript via `normalize("NFD")` é um recurso extremamente leve suportado de forma nativa por todos os navegadores modernos, evitando a dependência de pacotes externos de manipulação de strings na SPA.*
