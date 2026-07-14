import React, { createContext, useContext, useState, useEffect } from 'react';
import type { IAuthState, IUser, UserRole } from '../types/Auth';
import { LoginModal } from '../components/LoginModal';

interface IAuthContext extends IAuthState {
  Login: (email: string, password: string) => Promise<boolean>;
  Register: (email: string, password: string, username: string) => Promise<{ success: boolean; error?: string }>;
  Logout: () => void;
  UpdateCurrentUser: (user: IUser) => void;
  RefreshTokenClaims: () => Promise<void>;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isLoginModalOpen: boolean;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

import { API_URL } from '../config';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const [state, setState] = useState<IAuthState>({
    IsAuthenticated: false,
    CurrentUser: null,
    Token: null
  });

  const [isLoading, setIsLoading] = useState(true);

  // Restaura a sessão na inicialização fazendo o fetch no endpoint real /api/Auth/Me
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem('mixer8_token');
      if (savedToken) {
        try {
          const res = await fetch(`${API_URL}/Auth/Me`, {
            headers: {
              'Authorization': `Bearer ${savedToken}`
            }
          });

          if (res.ok) {
            const user: IUser = await res.json();
            setState({
              IsAuthenticated: true,
              CurrentUser: user,
              Token: savedToken
            });
          } else {
            // Token expirado ou inválido
            localStorage.removeItem('mixer8_token');
          }
        } catch {
          // Erro de rede, mantém offline ou tenta carregar local temporariamente
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const Login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/Auth/Login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Email: email, Password: password })
      });

      if (!res.ok) return false;

      const data = await res.json();
      localStorage.setItem('mixer8_token', data.Token);

      const user: IUser = {
        UserId: crypto.randomUUID(), // Temporário até fazer o Me
        Email: data.Email,
        UserRole: data.UserRole as UserRole,
        CreatedAt: new Date().toISOString(),
        UserName: data.UserName || data.Email.split('@')[0]
      };

      setState({
        IsAuthenticated: true,
        CurrentUser: user,
        Token: data.Token
      });

      // Tenta carregar os dados reais completos do usuário
      try {
        const meRes = await fetch(`${API_URL}/Auth/Me`, {
          headers: {
            'Authorization': `Bearer ${data.Token}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setState({
            IsAuthenticated: true,
            CurrentUser: meData,
            Token: data.Token
          });
        }
      } catch {
        // Ignora falha silenciosa no Me, mantém dados básicos do login
      }

      return true;
    } catch {
      return false;
    }
  };

  const Register = async (email: string, password: string, username: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_URL}/Auth/Register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Email: email, Password: password, UserName: username })
      });

      if (!res.ok) {
        try {
          const errData = await res.json();
          return { success: false, error: errData.ErrorMessage };
        } catch {
          return { success: false, error: 'UNKNOWN_ERROR' };
        }
      }

      const data = await res.json();
      localStorage.setItem('mixer8_token', data.Token);

      const user: IUser = {
        UserId: crypto.randomUUID(),
        Email: data.Email,
        UserRole: data.UserRole as UserRole,
        CreatedAt: new Date().toISOString(),
        UserName: username
      };

      setState({
        IsAuthenticated: true,
        CurrentUser: user,
        Token: data.Token
      });

      // Tenta buscar os dados reais completos do usuário
      try {
        const meRes = await fetch(`${API_URL}/Auth/Me`, {
          headers: {
            'Authorization': `Bearer ${data.Token}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setState({
            IsAuthenticated: true,
            CurrentUser: meData,
            Token: data.Token
          });
        }
      } catch {
        // Ignora falha silenciosa
      }

      return { success: true };
    } catch {
      return { success: false, error: 'NETWORK_ERROR' };
    }
  };

  const UpdateCurrentUser = (user: IUser) => {
    setState(prev => ({
      ...prev,
      CurrentUser: user
    }));
  };

  const RefreshTokenClaims = async () => {
    const savedToken = localStorage.getItem('mixer8_token');
    if (!savedToken) return;
    try {
      const res = await fetch(`${API_URL}/Auth/RefreshToken`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('mixer8_token', data.Token);
        
        const meRes = await fetch(`${API_URL}/Auth/Me`, {
          headers: {
            'Authorization': `Bearer ${data.Token}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          setState({
            IsAuthenticated: true,
            CurrentUser: meData,
            Token: data.Token
          });
        }
      }
    } catch {
      // Falha silenciosa
    }
  };

  const Logout = () => {
    localStorage.removeItem('mixer8_token');
    setState({
      IsAuthenticated: false,
      CurrentUser: null,
      Token: null
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, Login, Register, Logout, UpdateCurrentUser, RefreshTokenClaims, openLoginModal, closeLoginModal, isLoginModalOpen }}>
      {!isLoading && children}
      {isLoginModalOpen && <LoginModal onClose={closeLoginModal} />}
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
