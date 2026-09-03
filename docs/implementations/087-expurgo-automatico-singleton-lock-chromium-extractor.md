# 087 - Extractor: Expurgo Preventivo de Travas Órfãs do Chromium (SingletonLock)

**Autor:** Eduardo Nascimento (Havenox)  
**Data:** 03/09/2026  

---

## 🚀 Desafio de Engenharia

Durante incidentes de indisponibilidade ou manutenção de contêineres Docker, o processo de interrupção ou reinício forçado (`docker restart`, `docker kill`, `kill -9` ou reinicializações do servidor hospedeiro) pode interromper o processo do Chromium antes que ele execute sua rotina de encerramento gracioso (*clean shutdown*).

No ecossistema Linux, o Google Chrome implementa um mecanismo rígido de processo único (*Process Singleton*). Ao abrir um perfil persistente (`user-data-dir`), o navegador cria descritores de trava e sockets IPC diretamente na raiz desse diretório:
- `SingletonLock`: Link simbólico (symlink) referenciando o identificador do host e o PID do processo (`<container_id>-<pid>`).
- `SingletonCookie`: Arquivo de validação de integridade de sessão.
- `SingletonSocket`: Socket Unix para encaminhamento de chamadas para a instância ativa.

Em arquiteturas conteinerizadas onde o diretório de perfil (`/app/config/user_profile`) é montado através de um volume persistente mapeado do host, cada recriação de contêiner gera um novo hostname e uma nova árvore de namespaces de PID. Ao inicializar o contêiner substituto, o Chromium lê `SingletonLock`, identifica que a trava aponta para um host/PID anterior e aborta imediatamente sua execução com a mensagem:
```text
The profile appears to be in use by another Google Chrome process (453) on another computer (1a03d79eab37).  
Chrome has locked the profile so that it doesn't get corrupted.  
To recover, delete the files SingletonLock, SingletonCookie, SingletonSocket in your profile directory.
```
Como o container opera em modo headless e não possui ferramentas de diálogo gráfico do sistema (como `zenity` ou `kdialog`), o navegador fecha na largada (código de saída não-zero), fazendo o Playwright lançar `Microsoft.Playwright.TargetClosedException` no método `LaunchPersistentContextAsync`. Isso causava falhas repetidas em cascata na fila do PostgreSQL para todas as faixas subsequentes.

---

## 🧠 Estratégia da Solução

Dado que a arquitetura do `mixer8-extractor` é estritamente mono-instância por contêiner (sincronizada via banco de dados relacional com locks `FOR UPDATE SKIP LOCKED`), qualquer trava remanescente de `Singleton*` encontrada no início de um ciclo de extração é, por definição, um artefato órfão (*stale lock*) de uma sessão anterior interrompida.

A solução consiste em implementar uma rotina de autocura e purga defensiva no ciclo de vida do worker:
1. **Inspeção Pré-Lançamento:** Imediatamente antes de invocar `playwright.Chromium.LaunchPersistentContextAsync`, o worker inspeciona o sistema de arquivos do diretório de perfil persistente.
2. **Exclusão Atômica de Arquivos e Symlinks:** Utilizando `DirectoryInfo.GetFileSystemInfos` com padrões glob (`SingletonLock*`, `SingletonCookie*`, `SingletonSocket*`, `lockfile*`), o worker identifica qualquer entrada (inclusive symlinks quebrados que apontem para nós inexistentes) e executa sua remoção com segurança.
3. **Resiliência e Tolerância a Falhas:** Caso o diretório ainda não exista (primeiro boot) ou ocorra qualquer erro de I/O em arquivos individuais, o erro é capturado e registrado como aviso, nunca bloqueando o fluxo principal da aplicação.

---

## 🛠️ Implementação Técnica

### Backend (`mixer8-extractor/Worker.cs`)

* **Método `PurgeStaleChromiumLocks(string userProfileDir)`:**
  Implementada rotina síncrona dedicada que varre as travas do perfil e deleta os descritores órfãos:
  ```csharp
  private void PurgeStaleChromiumLocks(string userProfileDir)
  {
      if (!Directory.Exists(userProfileDir)) return;

      try
      {
          var dirInfo = new DirectoryInfo(userProfileDir);
          var lockPatterns = new[] { "SingletonLock*", "SingletonCookie*", "SingletonSocket*", "lockfile*" };
          foreach (var pattern in lockPatterns)
          {
              var entries = dirInfo.GetFileSystemInfos(pattern, SearchOption.TopDirectoryOnly);
              foreach (var entry in entries)
              {
                  try
                  {
                      entry.Delete();
                      logger.LogInformation($"[WORKER] Trava órfã do Chromium removida preventivamente: {entry.Name}");
                      Console.WriteLine($"[BOT-PASSO] Limpeza preventiva: Trava órfã do Chromium removida: {entry.Name}");
                  }
                  catch (Exception ex)
                  {
                      logger.LogWarning($"[WORKER WARNING] Não foi possível remover trava órfã '{entry.Name}': {ex.Message}");
                  }
              }
          }
      }
      catch (Exception ex)
      {
          logger.LogWarning($"[WORKER WARNING] Falha na verificação preventiva de travas do perfil do navegador: {ex.Message}");
      }
  }
  ```
* **Chamada Pré-Boot:**
  A invocação foi inserida no início da preparação do navegador, antes de disparar o `LaunchPersistentContextAsync`:
  ```csharp
  // Blindagem contra reinícios forçados de contêineres: expurga travas órfãs do Chromium (SingletonLock, etc.)
  PurgeStaleChromiumLocks(userProfileDir);

  logger.LogInformation($"[WORKER] Lançando Chromium com Perfil Persistente (Headless: {isHeadless}, Canal: {browserChannel}, SlowMo: {slowMo}ms, Perfil: {userProfileDir})...");
  context = await playwright.Chromium.LaunchPersistentContextAsync(userProfileDir, contextOptions);
  ```

---

## 🎯 Impacto e Resultado

* **Autocura Completa:** Eliminação total da necessidade de intervenção manual no servidor (como `rm -f .../Singleton*`) após paradas de emergência, quedas de energia ou recriações de contêiner Docker.
* **Resiliência no Boot:** O contêiner pode ser reiniciado a qualquer momento sem risco de corrupção ou travamento por locks persistidos em volumes compartilhados.
* **Blindagem de Fila:** Previne que quedas inesperadas provoquem falhas falsas-positivas consecutivas que levariam faixas válidas ao limite de 5 tentativas (`ExtractionRetryCount = 5` / `Falhou`).

---

**Nota do Desenvolvedor:** *Ambientes Docker com volumes mapeados exigem atenção especial a mecanismos de lock baseados em hostnames e PIDs locais do Linux. O Chromium foi concebido para desktops mono-usuário e não antecipa que seu diretório de perfil sobreviverá a um processo enquanto seu hostname é destruído e substituído. Implementar a rotina de purga pré-lançamento garante a semântica de autocura essencial para microsserviços modernos de extração.*
