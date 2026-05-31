# 015 - [Backend]: Separação de Conceitos de Usuários (Users, UserRoles, UserProfiles)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Acumular dados de credenciais, perfis de usuários, permissões administrativas e preferências de notificação em uma única tabela ("Users") viola princípios de design de banco de dados e arquitetura limpa (Single Responsibility Principle). À medida que o sistema cresce, essa modelagem dificulta a evolução independente de metadados de perfil, o controle de privilégios (RBAC) e o armazenamento de preferências dinâmicas em JSON sem poluir a tabela de autenticação principal.

## 🧠 Estratégia da Solução
A tabela relacional `Users` foi segregada em três subentidades distintas conectadas por relacionamentos 1-para-1 com exclusão em cascata:
1. **User (Credencial básica e Status)**: Mantém apenas o UserId, Email, PasswordHash, IsActive, CreatedAt e UpdatedAt.
2. **UserRole (Controle de Acesso RBAC)**: Enumera as permissões (Admin, Moderator, PaidUser, User) de acesso e gerencia a atualização delas.
3. **UserProfile (Metadados do Perfil)**: Contém campos específicos de perfil como Name, Phone, BirthDate, Bio, AvatarUrl e um objeto JSONb encapsulado de preferências de notificação.

Esta separação foi feita de modo a preservar os contratos JSON de entrada e saída expostos para o frontend, mantendo compatibilidade retroativa total (zero-breaking changes no cliente) e garantindo robustez arquitetural no backend.

## 🛠️ Implementação Técnica

### Backend
* **Entidades de Domínio**:
  * Modificação de `User.cs` para remover a propriedade `UserRole` e adicionar as propriedades virtuais `UserRole` e `UserProfile` de navegação 1-para-1, além dos timestamps de controle de ciclo de vida.
  * Criação do enum `UserRoleType` e da entidade `UserRole.cs`.
  * Criação da entidade `UserProfile.cs` com a estrutura hierárquica `UserProfilePreferences` e `NotificationPreferences`.
* **Infraestrutura**:
  * Configuração das chaves e relacionamentos 1-para-1 em `Mixer8DbContext.cs` com `DeleteBehavior.Cascade`.
  * Mapeamento do objeto complexo `Preferences` com `.OwnsOne()` and `.ToJson()` aninhado para que a propriedade `Notifications` seja persistida e recuperada corretamente como JSON no PostgreSQL.
  * Alteração do helper de segurança `SecurityHelper.cs` para receber a role como parâmetro string isolado na assinatura de geração do token JWT.
  * Adaptação do seeding de dados no `Program.cs` para criar corretamente os dados relacionados para todos os usuários iniciais.
* **Controladores**:
  * Refatoração do `AuthController.cs` no endpoint `/api/Auth/Register` para instanciar as subentidades associadas no cadastro.
  * Atualização dos endpoints de login, listagem de usuários (`UsersController.cs`) e recuperação de dados de sessão (`/api/Auth/Me`) para realizar `.Include(u => u.UserRole)` e expor os dados compatíveis sem quebras.

## 🎯 Impacto e Resultado
* **Segregação de Responsabilidades**: Acesso a dados de credenciais, permissões e perfis é granular, melhorando o isolamento de segurança e performance de indexação no banco de dados.
* **Preferências Flexíveis**: Preferências de notificação são armazenadas como documento JSON nativo (JSONb) estruturado, facilitando a adição de novas preferências no futuro sem precisar alterar o esquema de tabelas do banco físico.
* **Compatibilidade Retroativa**: O frontend continua funcionando sem qualquer alteração nos endpoints de login, cadastro e controle de sessão.

---
**Nota do Desenvolvedor:** *A arquitetura de relacionamento 1-para-1 com exclusão em cascata garante a integridade referencial dos dados, enquanto o mapeamento do Owned Type JSON no EF Core 10 simplifica a manipulação de estruturas flexíveis que não necessitam de chaves primárias isoladas, como as preferências de notificação.*
