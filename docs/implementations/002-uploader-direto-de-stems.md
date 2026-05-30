# 002 - [Uploader]: Uploader Direto de Stems (ZIP/MP3)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Adicionar a capacidade de upload de faixas de stems diretamente na biblioteca sem depender do worker de extração da VPS. O fluxo precisava ser robusto para receber múltiplos arquivos `.mp3` pesados (entre 15MB e 30MB cada) ou um único pacote `.zip`, garantindo total proteção contra uploads maliciosos (executáveis, scripts, etc.), descompressão e renomeio em tempo de execução no servidor para o formato oficial em português.

## 🧠 Estratégia da Solução
1. **Configuração de Limits do ASP.NET**: Aumentar Kestrel e `FormOptions` para comportar pacotes de até 500MB de forma estável.
2. **Servidor de Arquivos Estáticos com CORS**: Configurar middleware de arquivos estáticos apontando para `wwwroot/stems` habilitando CORS sob medida, assegurando que o player da interface do usuário (Vite React SPA) consiga puxar os fluxos de áudio utilizando Web Audio API (requisito `crossOrigin = 'anonymous'`).
3. **Descompressão Segura e Mapeamento Inteligente**: No backend em .NET 10, ler os arquivos compactados em `.zip` na memória. Validar individualmente cada arquivo e extrair estritamente arquivos com extensão `.mp3`. Usar dicionário heurístico para mapear títulos em inglês (ex: `vocals_vocals.mp3`) para português (`Vocais.mp3`).
4. **UX Premium do Uploader**: Interface com drag-and-drop de alta fidelidade visual, com visualização de preview da arte de capa e classificação preditiva instantânea do tipo de stem no client-side com base no nome do arquivo.

## 🛠️ Implementação Técnica
### Backend (.NET 10)
- Configurada cota de payload multipart em `Program.cs` (`FormOptions` e Kestrel limitados a 500MB).
- Adicionado middleware de arquivos estáticos com resposta contendo cabeçalhos CORS (`Access-Control-Allow-Origin: *`) em `Program.cs`.
- Adicionado endpoint `POST api/Tracks/UploadDirect` em `TracksController.cs` mapeando dados, capa `cover.jpg` e descompactando zips sob validação de tipo de arquivo restrita a `.mp3`.

### Frontend (React / Vite)
- Desenvolvido o componente [UploadDireto.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/UploadDireto.tsx) contendo formulário drag-and-drop, indicador de progresso detalhado e mapeamento visual de stems.
- Adicionado link no menu lateral em [PersistentLayout.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/PersistentLayout.tsx) sob cargo `Admin` ou `PaidUser`.
- Cadastrada rota correspondente protegida em [App.tsx](file:///g:/DEV/mixer8/mixer8-app/src/App.tsx).

## 🎯 Impacto e Resultado
* **Independência de Processamento**: Usuários PRO podem rodar e escutar mixagens de stems instantaneamente sem fila na VPS.
* **Segurança de Sandbox**: Arquivos maliciosos empacotados em zips são descartados e ignorados completamente pelo servidor, persistindo apenas áudios legítimos.

---
**Nota do Desenvolvedor:** *A descompressão direta na memória RAM usando ZipArchive no .NET 10 evita o uso de I/O de disco desnecessário no servidor, minimizando latência e protegendo contra falhas de segurança conhecidas como 'Zip Slip' por meio do uso estrito de entry.Name.*
