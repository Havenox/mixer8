import React, { createContext, useContext, useState, useEffect } from 'react';
import { IAuthState, IUser, UserRole } from '../types/Auth';

interface IAuthContext extends IAuthState {
  Login: (email: string, password: string) => Promise<boolean>;
  Register: (email: string, password: string, role: UserRole) => Promise<boolean>;
  Logout: () => void;
  UpdateRole: (role: UserRole) => void;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

// Default users for demonstration
const DEFAULT_USERS: Record<string, { role: UserRole; pass: string }> = {
  'admin@mixer8.com': { role: 'Admin', pass: 'admin123' },
  'mod@mixer8.com': { role: 'Moderator', pass: 'mod123' },
  'paid@mixer8.com': { role: 'PaidUser', pass: 'paid123' },
  'user@mixer8.com': { role: 'User', pass: 'user123' }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<IAuthState>(() => {
    const saved = localStorage.getItem('mixer8_auth');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Ignorar erro e usar default
      }
    }
    return {
      IsAuthenticated: false,
      CurrentUser: null,
      Token: null
    };
  });

  useEffect(() => {
    localStorage.setItem('mixer8_auth', JSON.stringify(state));
  }, [state]);

  const Login = async (email: string, password: string): Promise<boolean> => {
    // Simula delay de rede
    await new Promise((resolve) => setTimeout(resolve, 800));

    const lowercaseEmail = email.toLowerCase();
    const mockUser = DEFAULT_USERS[lowercaseEmail];

    if (mockUser && password === mockUser.pass) {
      const user: IUser = {
        UserId: crypto.randomUUID(),
        Email: lowercaseEmail,
        UserRole: mockUser.role,
        CreatedAt: new Date().toISOString()
      };

      setState({
        IsAuthenticated: true,
        CurrentUser: user,
        Token: `mock-jwt-token-for-${user.UserId}`
      });
      return true;
    }

    // Se o usuário não existir nos padrões, criamos um básico com senha padrão para testabilidade
    if (password.length >= 6) {
      const user: IUser = {
        UserId: crypto.randomUUID(),
        Email: lowercaseEmail,
        UserRole: 'User',
        CreatedAt: new Date().toISOString()
      };

      setState({
        IsAuthenticated: true,
        CurrentUser: user,
        Token: `mock-jwt-token-for-${user.UserId}`
      });
      return true;
    }

    return false;
  };

  const Register = async (email: string, password: string, role: UserRole): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    const lowercaseEmail = email.toLowerCase();
    
    // Adiciona na lista temporária em memória para a sessão
    DEFAULT_USERS[lowercaseEmail] = { role, pass: password };

    const user: IUser = {
      UserId: crypto.randomUUID(),
      Email: lowercaseEmail,
      UserRole: role,
      CreatedAt: new Date().toISOString()
    };

    setState({
      IsAuthenticated: true,
      CurrentUser: user,
      Token: `mock-jwt-token-for-${user.UserId}`
    });
    return true;
  };

  const Logout = () => {
    setState({
      IsAuthenticated: false,
      CurrentUser: null,
      Token: null
    });
  };

  const UpdateRole = (role: UserRole) => {
    if (state.CurrentUser) {
      setState(prev => ({
        ...prev,
        CurrentUser: prev.CurrentUser ? { ...prev.CurrentUser, UserRole: role } : null
      }));
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, Login, Register, Logout, UpdateRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
