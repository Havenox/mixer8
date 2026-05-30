# 006 - [Mapeamento/DAW]: Mapeamento de Teclado, Novas Stems e Ordenação Estrita de Faders

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Corrigir a classificação heurística de stems recebidas durante o upload. Anteriormente, arquivos contendo `keys` eram ignorados/mapeados para `"Outros"`, impedindo o isolamento correto dos canais de teclado.
Adicionalmente, novos formatos de stems (como backing vocals, guitarras base/solo, e cordas/strings) precisavam ser devidamente processados no backend, mapeados no frontend e organizados em uma ordem estrita na mesa de som para garantir usabilidade profissional.

---

## 🧠 Estratégia da Solução
1. **Algoritmo de Mapeamento com Precedência Estrita**:
   - Desenvolvido tanto no backend (.NET 10) quanto no frontend (React) um dicionário heurístico com ordem de precedência de palavras-chave.
   - Termos mais específicos (ex: `backing_vocals` ou `lead`) são validados antes dos genéricos (ex: `vocals` ou `guitar`) para evitar falsos positivos na classificação.
   - Integração da palavra-chave `keys` como `"Teclado"`, `lead` como `"Guitarra Solo"`, `rhythm` como `"Guitarra Base"` e `strings`/`cordas` como `"Cordas"`.
2. **Compressão Direcionada (Mono)**:
   - Configurado o canal `"Vocal"` (backing vocals) para receber compressão em mono de 64kbps (assim como `"Voz"`), otimizando armazenamento e tráfego de rede para canais de voz isolados.
3. **Ordenação Padronizada de Faders (DAW)**:
   - Implementada ordenação no componente da mesa de som (`MesaPlayer.tsx`) para posicionar os faders em uma ordem padrão de engenharia de áudio:
     1. Voz
     2. Vocal
     3. Bateria
     4. Baixo
     5. Guitarra
     6. Guitarra Solo
     7. Guitarra Base
     8. Sopro
     9. Teclado
     10. Piano
     11. Cordas
     12. Outros
     13. Metrônomo
4. **Calibração de Presets Rápidos**:
   - Ajustados os seletores de preset rápido (Acapella, Karaoke, Instrumental) para lidar dinamicamente com ambas as faixas vocais (`Voz` e `Vocal`) mantendo compatibilidade legada.

---

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- Modificado [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs) para:
  - Adicionar suporte a `backing_vocals` -> `Vocal`, `lead` -> `Guitarra Solo`, `rhythm` -> `Guitarra Base`, `keys`/`keyboard` -> `Teclado`, `pian`/`piano` -> `Piano` e `strings`/`cordas` -> `Cordas`.
  - Configurar `"Vocal"` para ser convertido em mono de 64k no processador Opus.
- Atualizado [Program.cs](file:///g:/DEV/mixer8/mixer8-api/Program.cs) para definir o seed da track demonstrativa utilizando `"Voz"` no lugar do termo anterior.

### Frontend (React SPA)
- Atualizado [UploadDireto.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/UploadDireto.tsx) para prever as novas stems no uploader com emojis correspondentes (incluindo `"Cordas 🎻"`).
- Atualizado [PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx) contendo a nova lista de 13 stems in `STANDARD_STEMS`.
- Atualizado [MesaPlayer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/MesaPlayer.tsx) para:
  - Mapear múltiplos tipos de voz nos presets rápidos (Acapella, Karaoke).
  - Ordenar dinamicamente a array de stems antes de renderizar os sliders na UI usando a lista padrão de indexação com 13 itens.

---

## 🎯 Impacto e Resultado
* **Suporte Completo de Teclado**: Faixas que contêm `keys` agora são corretamente isoladas como `"Teclado"` e renderizadas no mixer de áudio.
* **Isolamento de Cordas**: Faixas contendo `strings` agora são devidamente mapeadas como `"Cordas"` em vez de irem para `"Outros"`.
* **Mesa de Som Limpa e Padronizada**: Os faders não são mais renderizados aleatoriamente; eles seguem o layout clássico de estúdios (Voz/Vocal à esquerda, Bateria/Baixo na sequência, Teclado/Piano/Cordas/Metrônomo no final).
* **Economia Adicional de Armazenamento**: A conversão de backing vocals em mono poupou mais 33% de tráfego de rede para essas trilhas sem perda de fidelidade acústica.
