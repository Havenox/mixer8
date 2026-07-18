import type { IQueueProvider, ITrack } from '../context/PlayerContext';

/**
 * Cria um provedor agnóstico de fila para a Biblioteca Geral e buscas paginadas.
 */
export const createLibraryQueueProvider = (
  apiUrl: string,
  token: string | null,
  searchQuery: string,
  visibilityFilter: string
): IQueueProvider => {
  const cleanSearch = searchQuery.trim();
  let showAllParam = '&showAll=true';
  let visibilityParam = '';
  if (visibilityFilter === 'public') {
    showAllParam = '&showAll=false';
    visibilityParam = '&visibility=Public';
  } else if (visibilityFilter === 'private') {
    visibilityParam = '&visibility=Private';
  } else if (visibilityFilter === 'unlisted') {
    visibilityParam = '&visibility=Unlisted';
  }
  const searchParam = cleanSearch ? `&search=${encodeURIComponent(cleanSearch)}` : '';

  return {
    id: `library:${visibilityFilter}:${cleanSearch}`,
    fetchNextPage: async (page: number, pageSize: number) => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${apiUrl}/Tracks?page=${page}&limit=${pageSize}${searchParam}${showAllParam}${visibilityParam}`,
          { headers }
        );

        if (!res.ok) {
          return { tracks: [], hasMore: false };
        }

        const data: ITrack[] = await res.json();
        return {
          tracks: data,
          hasMore: data.length >= pageSize
        };
      } catch (err) {
        console.warn('[QUEUE-PROVIDER] Erro ao carregar página da biblioteca:', err);
        return { tracks: [], hasMore: false };
      }
    }
  };
};

/**
 * Cria um provedor agnóstico de fila para faixas de uma Playlist específica.
 */
export const createPlaylistQueueProvider = (
  apiUrl: string,
  token: string | null,
  playlistId: string
): IQueueProvider => {
  return {
    id: `playlist:${playlistId}`,
    fetchNextPage: async (page: number, pageSize: number) => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${apiUrl}/Playlists/${playlistId}/Tracks?page=${page}&limit=${pageSize}`,
          { headers }
        );

        if (!res.ok) {
          return { tracks: [], hasMore: false };
        }

        const data: ITrack[] = await res.json();
        return {
          tracks: data,
          hasMore: data.length >= pageSize
        };
      } catch (err) {
        console.warn('[QUEUE-PROVIDER] Erro ao carregar página da playlist:', err);
        return { tracks: [], hasMore: false };
      }
    }
  };
};
