# 003 - [Arquitetura/Banco]: Mapeamento de Capas (CoverUrl) e Proteção de GitIgnore

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Assegurar que arquivos de áudio (.mp3) e imagens (.jpg/.png) pesados e sensíveis gerados por uploads físicos no ambiente de desenvolvimento local jamais fossem comitados acidentalmente no Git. Adicionalmente, fornecer uma infraestrutura de persistência real para imagens de capa de faixas (`CoverUrl`) no banco de dados PostgreSQL sem quebrar o ecossistema ou necessitar de re-escritas em disco complexas.

## 🧠 Estratégia da Solução
1. **Filtro Estrito do Repositório**: Adicionar regras no arquivo `.gitignore` bloqueando toda a pasta recursiva `wwwroot/stems/`, permitindo o desenvolvimento com áudios locais limpos e blindados de vazamentos de dados ou repositórios inchados.
2. **Schema Relacional no PostgreSQL**: Adicionar a propriedade de banco opcional `CoverUrl` (do tipo string nullable) à classe de domínio `Track` de forma sincronizada na API do backend e no serviço Worker em background.
3. **Migração Incremental do EF Core**: Criar e aplicar migrações controladas no banco PostgreSQL do Homelab (`192.168.18.110`) utilizando o comando `dotnet ef database update` em .NET 10.
4. **Resiliência do Endpoint**: Mapear e persistir o valor da variável de caminho relativo `coverUrl` no banco durante o processamento do uploader direto.

## 🛠️ Implementação Técnica
### Controle de Versionamento
- Atualizado o arquivo [.gitignore](file:///g:/DEV/mixer8/.gitignore) para ignorar `**/wwwroot/stems/`.

### Backend (.NET 10 / EF Core)
- Atualizada a entidade [Track.cs (mixer8-api)](file:///g:/DEV/mixer8/mixer8-api/Domain/Track.cs) e [Track.cs (mixer8-extractor)](file:///g:/DEV/mixer8/mixer8-extractor/Domain/Track.cs) contendo a nova propriedade `CoverUrl`.
- Gerada a migração relacional `20260530175708_AddCoverUrlToTrack` na pasta `Infrastructure/Migrations` e aplicada com sucesso no servidor PostgreSQL.
- Mapeado e associado o valor do link da capa ao criar o registro em [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs) na ação `UploadDirect`.

## 🎯 Impacto e Resultado
* **Segurança do Repositório**: O repositório Git mantém-se enxuto com `working tree clean` sem rastrear arquivos binários pesados de stems e capas.
* **Integridade de Metadados**: A existência da imagem de capa agora é um dado persistente relacional que pode ser consumido em qualquer ponta (microserviços, exportações e frontend).

---
**Nota do Desenvolvedor:** *Manter os modelos de domínio do Worker e da API 100% idênticos em relação à propriedade CoverUrl previne exceções indesejadas de incompatibilidade de mapeamento ao realizar transações ACID concorrentes no PostgreSQL.*
