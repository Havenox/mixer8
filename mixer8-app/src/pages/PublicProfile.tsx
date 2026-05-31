import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, ListMusic, User, Loader2, Clock
} from 'lucide-react';

import { API_URL, SERVER_URL } from '../config';

interface IPublicPlaylist {
  PlaylistId: string;
  Name: string;
  Visibility: string;
  Description?: string;
  OwnerId: string;
  OwnerEmail: string;
  CoverUrl?: string;
  CreatedAt: string;
  TracksCount: number;
}

interface IPublicProfile {
  UserName: string;
  FirstName?: string;
  LastName?: string;
  Bio?: string;
  AvatarUrl?: string;
  FollowersCount: number;
  FollowingCount: number;
  PublicPlaylists: IPublicPlaylist[];
}

export const PublicProfile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { Token } = useAuth();

  const [profile, setProfile] = useState<IPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lógica de cálculo determinística de duração mockada
  const getPlaylistTotalDuration = (playlistId: string, tracksCount: number) => {
    if (tracksCount === 0) return '0 min';
    let sum = 0;
    for (let i = 0; i < playlistId.length; i++) {
      sum += playlistId.charCodeAt(i);
    }
    let totalSeconds = 0;
    for (let idx = 0; idx < tracksCount; idx++) {
      const trackSeed = (sum + idx) % 120;
      totalSeconds += 180 + trackSeed;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${totalMinutes} min`;
  };

  useEffect(() => {
    if (!username) return;

    // A rota deve escutar apenas caminhos começados por @
    if (!username.startsWith('@')) {
      navigate('/', { replace: true });
      return;
    }

    const cleanUsername = username.substring(1); // Remove o '@'
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const headers: Record<string, string> = {};
        if (Token) {
          headers['Authorization'] = `Bearer ${Token}`;
        }
        
        const res = await fetch(`${API_URL}/Auth/Profile/${cleanUsername}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else if (res.status === 404) {
          setError('Usuário não encontrado.');
        } else {
          setError('Não foi possível carregar o perfil.');
        }
      } catch {
        setError('Erro de conexão com o servidor.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username, Token, navigate]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2.5 text-brand-gray select-none">
        <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
        <span className="font-semibold text-sm">Carregando perfil...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 select-none">
        <span className="font-bold text-sm text-center text-red-400">{error || 'Perfil não encontrado.'}</span>
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-semibold text-brand-gray hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para o Explorar
        </button>
      </div>
    );
  }

  const hasFullName = profile.FirstName?.trim() || profile.LastName?.trim();
  const displayName = hasFullName 
    ? `${profile.FirstName || ''} ${profile.LastName || ''}`.trim() 
    : profile.UserName;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300 select-none pb-12">
      {/* Botão de Voltar */}
      <button 
        onClick={() => navigate(-1)}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors font-semibold text-xs cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Header do Perfil estilo Spotify */}
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-end bg-gradient-to-b from-brand-hover/40 to-transparent p-8 rounded-lg border border-brand-hover/30 shadow-inner relative overflow-hidden">
        {/* Avatar Grande */}
        <div className="w-36 h-36 md:w-44 md:h-44 bg-brand-black border border-brand-hover rounded-full shadow-2xl flex items-center justify-center shrink-0 overflow-hidden relative group">
          {profile.AvatarUrl ? (
            <img 
              src={profile.AvatarUrl.startsWith('http') ? profile.AvatarUrl : `${SERVER_URL}${profile.AvatarUrl}`} 
              alt={`Avatar de ${displayName}`} 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full rounded-full bg-brand-hover flex items-center justify-center text-brand-green/30">
              <User className="w-20 h-20" />
            </div>
          )}
        </div>

        {/* Informações */}
        <div className="flex-1 flex flex-col gap-2.5 text-center md:text-left">
          <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded self-center md:self-start">
            Perfil Público
          </span>

          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-none m-0 select-text uppercase">
            {displayName}
          </h1>

          {hasFullName && (
            <span className="text-sm font-semibold text-brand-gray/80 leading-none">
              @{profile.UserName}
            </span>
          )}

          {profile.Bio && (
            <p className="text-xs text-brand-gray leading-normal m-0 max-w-xl select-text mt-1">
              {profile.Bio}
            </p>
          )}

          {/* Estatísticas do Perfil */}
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-brand-gray font-bold uppercase tracking-wider mt-2.5">
            <span>
              {profile.PublicPlaylists.length} {profile.PublicPlaylists.length === 1 ? 'playlist pública' : 'playlists públicas'}
            </span>
            
            {profile.FollowersCount > 0 && (
              <>
                <span className="text-brand-gray/30">•</span>
                <span>{profile.FollowersCount} seguidores</span>
              </>
            )}

            {profile.FollowingCount > 0 && (
              <>
                <span className="text-brand-gray/30">•</span>
                <span>{profile.FollowingCount} seguindo</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid de Playlists Públicas */}
      <div className="flex flex-col gap-4 mt-4">
        <h2 className="text-lg font-bold text-white m-0 flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-brand-green" /> Playlists Públicas
        </h2>

        {profile.PublicPlaylists.length === 0 ? (
          <div className="text-sm text-brand-gray bg-brand-card border border-brand-hover p-8 rounded-md text-center font-semibold shadow-lg italic">
            Nenhuma playlist pública criada por este usuário.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {profile.PublicPlaylists.map((playlist) => (
              <div 
                key={playlist.PlaylistId} 
                className="bg-brand-card border border-brand-hover p-4 rounded hover:bg-brand-hover transition-all flex flex-col gap-3 group shadow-lg relative cursor-pointer"
                onClick={() => navigate(`/playlists/${playlist.PlaylistId}`)}
              >
                <div className="aspect-square bg-black border border-brand-hover rounded flex items-center justify-center text-brand-green shadow-md overflow-hidden relative shrink-0">
                  {playlist.CoverUrl ? (
                    <img 
                      src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                      alt={playlist.Name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ListMusic className="w-12 h-12" />
                  )}
                </div>
                
                <div className="flex flex-col truncate">
                  <span className="font-bold text-sm text-white truncate">{playlist.Name}</span>
                  {playlist.Description && (
                    <span className="text-[11px] text-brand-gray truncate mt-0.5">{playlist.Description}</span>
                  )}
                  
                  {/* Qtd Músicas • Reloginho Duração */}
                  <div className="flex items-center gap-1.5 text-[10px] text-brand-green font-semibold mt-1.5 select-none leading-none">
                    <span>{playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}</span>
                    <span className="text-brand-gray/40 font-normal select-none">•</span>
                    <div className="flex items-center gap-1 text-brand-gray font-normal leading-none h-3.5">
                      <Clock className="w-3 h-3 text-brand-gray/60 shrink-0" />
                      <span>{getPlaylistTotalDuration(playlist.PlaylistId, playlist.TracksCount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
