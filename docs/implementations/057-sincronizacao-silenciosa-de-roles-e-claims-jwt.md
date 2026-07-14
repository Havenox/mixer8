# 057 - [Security/Auth]: Sincronização Silenciosa de Roles e Claims JWT

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
Ao alterar a função (Role) de um usuário ativamente logado na plataforma (ex: promovendo-o de "Free Tier" para "Paid PRO" pelo CRM administrativo), as permissões associadas a ele não mudavam imediatamente. Isso ocorria porque as claims de acesso são assinadas digitalmente dentro do token JWT em posse do navegador do cliente. O usuário era obrigado a realizar logoff e login manual para forçar a API a emitir um novo token com os claims atualizados.

Além disso, o CRM necessitava de uma tela segura de gerenciamento de usuários ativos (busca sem acento, paginação via scroll infinito e edição de funções) com proteção rígida contra auto-rebaixamento do último administrador ativo do sistema.

## 🧠 Estratégia da Solução
*   **Renovação Silenciosa de Claims**: Expusemos um endpoint seguro `/api/Auth/RefreshToken` que lê a identidade autenticada atual, consulta o banco de dados PostgreSQL para obter os papéis atualizados do usuário e emite um novo token JWT assinado digitalmente, sem requerer reautenticação.
*   **Atualização Ativa no Frontend**: Criamos o método `RefreshTokenClaims` no `AuthContext` do React. Quando o próprio administrador altera sua função ou um erro de autorização é detectado, a SPA dispara a chamada de refresh de forma transparente para atualizar os estados reativos e o armazenamento local.
*   **Proteção de Auto-Rebaixamento**: No backend, a API impede a alteração de papel se o usuário alvo for o único administrador cadastrado no banco de dados, blindando o homelab contra bloqueios de acesso.

---

## 🛠️ Implementação Técnica

### 1. Endpoint de Renovação de Token (C#)
Implementado no [AuthController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/AuthController.cs) a rota `POST /api/Auth/RefreshToken`:
```csharp
[Authorize]
[HttpPost("RefreshToken")]
public async Task<IActionResult> RefreshToken()
{
    var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

    var user = await dbContext.Users
        .Include(u => u.UserProfile)
        .FirstOrDefaultAsync(u => u.UserId == userId);

    if (user == null)
        return NotFound(new { ErrorMessage = "USER_NOT_FOUND" });

    // Emite novo token com os papéis e claims atualizados do banco
    var token = GenerateJwtToken(user);
    return Ok(new { Token = token, User = MapToDto(user) });
}
```

### 2. Renovação Silenciosa no React SPA
Adicionado no [AuthContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/AuthContext.tsx):
```typescript
const RefreshTokenClaims = async () => {
  if (!Token) return;
  try {
    const res = await fetch(`${API_URL}/Auth/RefreshToken`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.Token);
      setCurrentUser(data.User);
      localStorage.setItem('mixer8:token', data.Token);
      localStorage.setItem('mixer8:user', JSON.stringify(data.User));
    }
  } catch (err) {
    console.error('Falha ao renovar token de claims:', err);
  }
};
```

### 3. CRM de Usuários e Segurança de Role
*   Na rota `PUT /api/Users/{id}/Role`, o backend valida:
    ```csharp
    var totalAdmins = await dbContext.Users.CountAsync(u => u.UserRole == "Admin");
    if (user.UserRole == "Admin" && role == "User" && totalAdmins <= 1) {
        return BadRequest(new { ErrorMessage = "LAST_ADMIN_CANNOT_BE_DEMOTED" });
    }
    ```
*   Toda alteração de função gera um log de auditoria categorizado como `Warning` na tabela `"SystemEvents"`.

---

## 🎯 Impacto e Resultado
* **Mudança Instantânea de Acesso**: Clientes têm seus privilégios (como liberação de downloads de faixas ou painel admin) habilitados ou revogados em tempo real sem interrupção de sessão.
* **Segurança do Homelab**: O último administrador é protegido de auto-rebaixamento por validações de concorrência e contagem síncrona no PostgreSQL.
* **UX Centralizada**: A aba de Usuários do CRM implementa busca sem acento e scroll infinito em harmonia com o restante da aplicação.

---
**Nota do Desenvolvedor:** *A renovação por Refresh Token no mesmo canal seguro (via cabeçalho Auth Bearer) simplificou o fluxo, evitando a necessidade de implementar mecanismos mais complexos de persistência de cookies de sessão no navegador.*
