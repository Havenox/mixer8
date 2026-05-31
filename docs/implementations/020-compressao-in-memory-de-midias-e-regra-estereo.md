# 020 - [Áudio/Mídia]: Compressão In-Memory Universal de Mídias e Regra de Estéreo

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Até então, o uploader de áudios da aplicação (tanto via Spleeter AI quanto no uploader direto de Stems) era restrito a extensões básicas como `.mp3` e arquivos `.zip` contendo apenas arquivos de áudio. Além disso, no uploader direto, se o usuário enviasse um arquivo pesado como um contêiner de vídeo (MKV, MP4, etc.), a API não tinha suporte nativo para extrair seu áudio. Os arquivos de entrada pesados costumavam tocar o disco físico do servidor antes de serem processados, o que causava séria ineficiência no consumo de armazenamento e risco de exaustão de I/O em concorrência.

Outro ponto crítico era a regra de mono obrigatória para stems identificadas como Voz, Vocal, Baixo e Metrônomo. Embora fizesse sentido para mixagens avançadas de múltiplos canais isolados, essa regra forçava a compressão mono em uploads de **faixa única** (ex: o usuário querendo ouvir um áudio completo já mixado contendo apenas a voz principal ou uma base instrumental isolada), prejudicando a fidelidade estéreo original. Por fim, a interface do React SPA renderizava no rodapé um texto redundante e inestético `"Faixa Única / Mono"` juntamente com uma caixa cinza, poluindo visualmente o player de áudio minimalista.

## 🧠 Estratégia da Solução
Para solucionar essas limitações técnicas e proporcionar uma experiência premium e performática:
1. **Pipeline de Áudio Universal e Seguro**: Expandimos as extensões aceitas de mídia (`AllowedMediaExtensions`) na API para cobrir também populares contêineres de áudio e vídeo (`.mp4`, `.mkv`, `.avi`, `.mov`, `.webm`, `.flv`, etc.).
2. **Processamento In-Memory de Extrema Eficiência**: Reconfiguramos o uploader com extrator Spleeter para abrir o stream in-memory do arquivo de mídia recebido (`request.File.OpenReadStream()`) e passá-lo diretamente para a entrada padrão do FFmpeg (`pipe:0`). Com isso, o FFmpeg extrai o áudio e codifica para o formato de alta performance Opus (`.opus`) de forma instantânea em memória, gravando unicamente o arquivo final ultra leve de áudio no disco. Vídeos gigantescos de até 500MB agora são processados sem tocar o disco do servidor com o seu arquivo original.
3. **Regra Estéreo Inteligente para Faixa Única**: Implementamos um mecanismo que pré-calcula a quantidade final de faixas/stems a serem persistidas no banco e salvas em disco durante o uploader direto e edição. Se houver **apenas 1 faixa** no total, o backend anula compulsoriamente a conversão para mono e codifica o áudio em estéreo de alta fidelidade (2 canais a 96k), preservando a pureza sonora espacial original.
4. **Refinamento do Player Visualmente Premium**: Modificamos o player de música do React SPA para adotar uma lógica de curto-circuito condicional. O botão do Mixer DAW e o texto `"Faixa Única / Mono"` foram removidos por completo em músicas de faixa única, deixando a área direita sutil, limpa e minimalista de acordo com os padrões visuais modernos.

## 🛠️ Implementação Técnica

### Backend (.NET 10 / C# 13)
- **TracksController.cs**:
  - Definida a lista unificada de mídias aceitas em `AllowedMediaExtensions`.
  - Atualizado o uploader com extrator Spleeter (`Upload`) para usar a leitura in-memory do arquivo, invocando o FFmpeg via pipeline (`ConvertToOpusAsync`) sem arquivo físico temporário de entrada no servidor.
  - Implementado o método utilitário `ShouldForceMono(string stemType, bool isSingleTrack)` que retorna `false` quando for faixa única (`isSingleTrack == true`).
  - No método `UploadDirect`, implementado o pré-cálculo inteligente de faixas válidas contidas na requisição (incluindo leitura em memória de zip). Passado o parâmetro `forceMono` condicional no loop de salvamento de Stems.
  - No método `ProcessStemsZip`, ajustada a chamada a `ConvertToOpusAsync` para definir a regra padrão baseada em múltiplos canais gerados pela AI (forçando mono nos canais especificados).
  - No método `Update`, integrado o cálculo dinâmico de stems finais restantes após a soma de exclusões de stems selecionadas, substituições individuais e adições gerais. Isso garante que a regra de estéreo seja mantida de forma consistente mesmo após atualizações cadastrais.

### Frontend (React SPA + Vite)
- **MesaPlayer.tsx**:
  - Modificado o rodapé direito do player para remover o bloco de controle `else` com a div estática do texto `"Faixa Única / Mono"`.
  - Empregada renderização condicional estrita com `{hasMultipleStems && ( ... )}` para exibir o botão do Mixer apenas em músicas de múltiplos canais.

## 🎯 Impacto e Resultado
* **Segurança de Armazenamento**: O disco temporário do servidor nunca mais é inflado por uploads massivos de vídeo ou arquivos brutos de áudio. O pipeline de stream do FFmpeg converte tudo em tempo de voo e salva apenas o arquivo compactado em Opus.
* **Fidelidade Acústica Aprimorada**: Músicas e arquivos de áudio completos de canal único agora são entregues em estéreo cristalino de alta qualidade.
* **Interface Visualmente Premium**: Um layout moderno, polido e sutil no player de áudio do React SPA que se assemelha às melhores experiências de tocadores globais de música.
* **Integridade das Operações**: Compilação impecável com 0 avisos e 0 erros tanto no backend C# quanto no verificador de tipos TypeScript do React.

---
**Nota do Desenvolvedor:** *A flexibilidade de processar streams de mídia inteiramente na memória RAM por meio do pipeline de redirecionamento de streams do FFmpeg resolve o gargalo histórico de I/O em disco de forma definitiva. Com o player mais sutil e a inteligência de preservação de estéreo, a plataforma atinge um patamar superior de acabamento técnico e usabilidade.*
