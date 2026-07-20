export interface ParsedMetadata {
  songName: string;
  artistName: string;
}

/**
 * Algoritmo inteligente para detectar e limpar o Nome da Música e do Artista
 * a partir de nomes de arquivos locais ou títulos de vídeos do YouTube.
 */
export function parseTrackMetadata(rawTitle: string, fallbackArtist?: string): ParsedMetadata {
  // 0. Limpeza prévia do fallbackArtist (remover - Topic, Ao Vivo, Cover, etc.)
  const cleanFallback = fallbackArtist
    ? fallbackArtist
        .replace(/\s*-\s*[Tt]opic\s*$/gi, '')
        .replace(/\s*[\(\[][Aa]o\s*[Vv]ivo[\)\]]/gi, '')
        .replace(/\s*[\(\[][Cc]over[\)\]]/gi, '')
        .replace(/\s*[\(\[][Oo]fficial[\)\]]/gi, '')
        .replace(/\s*[\(\[][Of]icial[\)\]]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

  if (!rawTitle) {
    return { songName: '', artistName: cleanFallback };
  }

  // 1. Limpeza inicial de tags comuns (Ao Vivo, Cover, Topic, tags do YouTube)
  let cleaned = rawTitle
    // Remove sufixo de canal do YouTube (ex: " - Topic")
    .replace(/\s*-\s*[Tt]opic\s*$/gi, '')
    // Remove tag de gravação Ao Vivo
    .replace(/\s*[\(\[][Aa]o\s*[Vv]ivo[\)\]]/gi, '')
    // Remove tag de Cover
    .replace(/\s*[\(\[][Cc]over[\)\]]/gi, '')
    // Remove tag de Acústico / Acoustic
    .replace(/\s*[\(\[][Aa]coustic[\)\]]/gi, '')
    .replace(/\s*[\(\[][Aa]cústico[\)\]]/gi, '')
    // Remove Remix / Version / Single / EP
    .replace(/\s*[\(\[][Rr]emix[\)\]]/gi, '')
    .replace(/\s*[\(\[][Vv]ersion[\)\]]/gi, '')
    .replace(/\s*[\(\[][Ss]ingle[\)\]]/gi, '')
    .replace(/\s*[\(\[][Ee][Pp][\)\]]/gi, '')
    // Remove termos comuns de vídeos do YouTube
    .replace(/\s*[\(\[][Oo]fficial\s*[Vv]ideo[\)\]]/gi, '')
    .replace(/\s*[\(\[][Oo]fficial\s*[Aa]udio[\)\]]/gi, '')
    .replace(/\s*[\(\[][Oo]fficial\s*[Mm]usic\s*[Vv]ideo[\)\]]/gi, '')
    .replace(/\s*[\(\[][Oo]fficial\s*[Ll]yric\s*[Vv]ideo[\)\]]/gi, '')
    .replace(/\s*[\(\[][Ll]yric\s*[Vv]ideo[\)\]]/gi, '')
    .replace(/\s*[\(\[][Ll]yrics\s*[Vv]ideo[\)\]]/gi, '')
    .replace(/\s*[\(\[][Vv]ídeo\s*[Oo]ficial[\)\]]/gi, '')
    .replace(/\s*[\(\[][Cc]lipe\s*[Oo]ficial[\)\]]/gi, '')
    .replace(/\s*[\(\[][Aa]udio\s*[Oo]ficial[\)\]]/gi, '')
    .replace(/\s*[\(\[][Vv]ídeo\s*[Ll]írico[\)\]]/gi, '')
    .replace(/\s*[\(\[][Cc]lipe\s*[Ll]írico[\)\]]/gi, '')
    .replace(/\s*[\(\[][Ll]ive[\)\]]/gi, '')
    .replace(/\s*[\(\[]HD[\)\]]/gi, '')
    .replace(/\s*[\(\[]4[Kk][\)\]]/gi, '')
    .replace(/\s*[\(\[][Ll]yrics[\)\]]/gi, '')
    .replace(/\s*[\(\[][Ll]yric[\)\]]/gi, '')
    .replace(/\s*[\(\[][Oo]fficial[\)\]]/gi, '')
    .replace(/\s*[\(\[][Of]icial[\)\]]/gi, '')
    .replace(/\s*[\(\[][Cc]lipe[\)\]]/gi, '')
    .replace(/\s*[\(\[][Vv]ídeo[\)\]]/gi, '')
    .replace(/\s*[\(\[][Vv]ideo[\)\]]/gi, '')
    .trim();

  // Substitui múltiplos espaços consecutivos causados pelas substituições por um espaço único
  cleaned = cleaned.replace(/\s+/g, ' ');

  // 2. Divisão por separadores comuns
  const separators = [' - ', ' – ', ' — ', ' | ', ' |'];
  let sepFound = '';
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      sepFound = sep;
      break;
    }
  }

  let parts: string[] = [];
  if (sepFound) {
    parts = cleaned.split(sepFound).map(p => p.trim()).filter(Boolean);
  } else {
    // Se não houver delimitador estruturado, tenta dividir pelo caractere hífen cru "-"
    if (cleaned.includes('-')) {
      parts = cleaned.split('-').map(p => p.trim()).filter(Boolean);
    } else {
      parts = [cleaned];
    }
  }

  // 3. Descartar numeração de faixa inicial se houver (ex: "02 - Música", "05. Música")
  if (parts.length > 1) {
    const firstPart = parts[0];
    const isTrackNumber = /^\d+\.?$/.test(firstPart);
    if (isTrackNumber) {
      parts.shift(); // Remove o número
    }
  }

  let parsedArtist = '';
  let parsedSong = '';

  // 4. Mapear partes para artista e música
  if (parts.length >= 2) {
    // Convenção padrão: [Artista] - [Música]
    parsedArtist = parts[0];
    parsedSong = parts.slice(1).join(' - '); // Une demais partes com traço se houver subdivisões
  } else if (parts.length === 1) {
    parsedSong = parts[0];
    parsedArtist = cleanFallback;
  }

  // Heurística de Autor/Artista do Youtube para auto-inversão se vier [Música] - [Artista]
  if (cleanFallback) {
    if (
      parsedSong.toLowerCase() === cleanFallback.toLowerCase() &&
      parsedArtist.toLowerCase() !== cleanFallback.toLowerCase()
    ) {
      // Inverte pois o nome detectado como música bateu com o autor do canal do Youtube
      const temp = parsedSong;
      parsedSong = parsedArtist;
      parsedArtist = temp;
    }
  }

  return {
    songName: toTitleCase(parsedSong.trim()),
    artistName: toTitleCase(parsedArtist.trim()),
  };
}

/**
 * Converte uma string para o padrão Title Case, mantendo palavras de ligação em minúsculo
 * e siglas conhecidas (ex: DJ, MC) em maiúsculo.
 */
function toTitleCase(text: string): string {
  if (!text) return '';

  const lowercaseWords = new Set([
    // Português
    'e', 'ou', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 
    'com', 'por', 'para', 'a', 'o', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'ao', 'aos',
    // Inglês
    'and', 'or', 'of', 'in', 'the', 'a', 'an', 'to', 'for', 'by', 'with', 'at', 'from', 'on'
  ]);

  const uppercaseWords = new Set([
    'dj', 'mc', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'
  ]);

  const words = text.split(/\s+/);
  
  const formattedWords = words.map((word, index) => {
    // Extrai apenas a parte alfanumérica para checagem, ignorando pontuações nas bordas
    const cleanWord = word.replace(/^[^\w\dÀ-ÿ]+|[^\w\dÀ-ÿ]+$/g, '').toLowerCase();
    
    if (!cleanWord) return word;

    if (uppercaseWords.has(cleanWord)) {
      return word.toUpperCase();
    }

    if (lowercaseWords.has(cleanWord) && index > 0 && index < words.length - 1) {
      return word.toLowerCase();
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return formattedWords.join(' ');
}

