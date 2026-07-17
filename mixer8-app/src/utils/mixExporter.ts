import lamejs from 'lamejs';
import { transposeChord } from '../hooks/useLyricsChords';
import type { ITrack } from '../context/PlayerContext';

export interface IMixExportOptions {
  currentTrack: ITrack;
  stemsVolume: Record<string, number>;
  stemsMute: Record<string, boolean>;
  stemsSolo: Record<string, boolean>;
  stemsPan: Record<string, number>;
  masterVolume: number;
  transpose: number;
  bpmDelta: number;
  isPremium: boolean;
  getCachedOrFetchAudioUrl: (url: string, isPremiumUser: boolean) => Promise<string>;
  onProgress: (progress: number, statusMessage: string) => void;
}

export interface IMixExportResult {
  fileName: string;
  blob: Blob;
}

const sanitizeFileName = (str: string): string => {
  return str.replace(/[/\\?%*:|"<>]/g, '').trim();
};

const floatToInt16 = (float32Array: Float32Array): Int16Array => {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
};

export const exportMixToMp3 = async (options: IMixExportOptions): Promise<IMixExportResult> => {
  const {
    currentTrack,
    stemsVolume,
    stemsMute,
    stemsSolo,
    stemsPan,
    masterVolume,
    transpose,
    bpmDelta,
    isPremium,
    getCachedOrFetchAudioUrl,
    onProgress
  } = options;

  if (!currentTrack || !currentTrack.Stems || currentTrack.Stems.length === 0) {
    throw new Error('Nenhuma faixa com stems disponível para exportar.');
  }

  // 1. Calcula Metadados e Nome do Arquivo conforme padrão solicitado:
  // <nomedamusica> - <nome do artista> (<tom> - <bpm>bpm).mp3
  const displayKey = currentTrack.Key ? transposeChord(currentTrack.Key, transpose) : '--';
  const baseBpm = currentTrack.Bpm || 120;
  const calculatedBpm = Math.max(30, baseBpm + bpmDelta);
  const rawFileName = `${currentTrack.TrackTitle} - ${currentTrack.ArtistName} (${displayKey} - ${calculatedBpm}bpm).mp3`;
  const fileName = sanitizeFileName(rawFileName);

  onProgress(5, 'Baixando faixas para renderização...');

  // 2. Carrega e Decodifica AudioBuffers de todas as Stems
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const decodeCtx = new AudioCtxClass();

  const stemBuffers: { stemType: string; buffer: AudioBuffer }[] = [];
  const totalStems = currentTrack.Stems.length;

  for (let i = 0; i < totalStems; i++) {
    const stem = currentTrack.Stems[i];
    const progressPercent = 5 + Math.round(((i + 1) / totalStems) * 25);
    onProgress(progressPercent, `Baixando stem ${stem.StemType} (${i + 1}/${totalStems})...`);

    try {
      const resolvedUrl = await getCachedOrFetchAudioUrl(stem.AudioUrl, isPremium);
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        console.warn(`[EXPORT] Falha ao carregar áudio da stem: ${stem.StemType}`);
        continue;
      }
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
      stemBuffers.push({ stemType: stem.StemType, buffer: decodedBuffer });
    } catch (err) {
      console.warn(`[EXPORT] Erro ao processar stem ${stem.StemType}:`, err);
    }
  }

  try {
    await decodeCtx.close();
  } catch (e) {
    // Ignora erros ao fechar o contexto de decodificação temporário
  }

  if (stemBuffers.length === 0) {
    throw new Error('Falha ao decodificar as pistas de áudio da música.');
  }

  // 3. Calcula a duração máxima em segundos considerando a taxa de velocidade (BPM/Transpose)
  const speedRatio = (calculatedBpm / baseBpm) * Math.pow(2, transpose / 12);
  let maxDuration = 0;
  for (const { buffer } of stemBuffers) {
    const adjustedDuration = buffer.duration / speedRatio;
    if (adjustedDuration > maxDuration) {
      maxDuration = adjustedDuration;
    }
  }

  // 4. Cria a OfflineAudioContext (2 canais, 48000 Hz)
  const sampleRate = 48000;
  const totalSamples = Math.ceil(maxDuration * sampleRate);
  
  onProgress(35, 'Reconstruindo mesa de mixagem na OfflineAudioContext...');
  const offlineCtx = new OfflineAudioContext(2, totalSamples, sampleRate);

  // Nó Master
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = masterVolume;
  masterGain.connect(offlineCtx.destination);

  // Lógica de Mute / Solo
  const hasAnySolo = Object.values(stemsSolo).some(v => v);

  for (const { stemType, buffer } of stemBuffers) {
    const vol = stemsVolume[stemType] ?? 1.0;
    const muted = stemsMute[stemType] ?? false;
    const solo = stemsSolo[stemType] ?? false;
    const pan = stemsPan[stemType] ?? 0.0;

    const effectiveGain = (muted || (hasAnySolo && !solo)) ? 0.0 : vol;
    if (effectiveGain <= 0) continue; // Pista silenciada

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speedRatio;

    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = effectiveGain;

    const pannerNode = offlineCtx.createStereoPanner();
    pannerNode.pan.value = Math.max(-1, Math.min(1, pan));

    source.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(masterGain);

    source.start(0);
  }

  // 5. Renderiza a mixagem offline
  onProgress(45, 'Renderizando mixagem offline em 48kHz...');
  const renderedAudioBuffer = await offlineCtx.startRendering();

  // 6. Codificação PCM Float32 -> MP3 192 kbps 48 kHz usando lamejs
  onProgress(55, 'Codificando MP3 192kbps 48kHz...');

  const Mp3Encoder = (lamejs as any).Mp3Encoder || (lamejs as any).default?.Mp3Encoder || lamejs.Mp3Encoder;
  const mp3encoder = new Mp3Encoder(2, sampleRate, 192);

  const leftChannelFloat = renderedAudioBuffer.getChannelData(0);
  const rightChannelFloat = renderedAudioBuffer.getChannelData(1);

  const sampleBlockSize = 1152 * 8; // Processa em blocos para manter a UI 100% fluida
  const mp3DataChunks: Uint8Array[] = [];

  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const end = Math.min(i + sampleBlockSize, totalSamples);
    const leftChunk = floatToInt16(leftChannelFloat.subarray(i, end));
    const rightChunk = floatToInt16(rightChannelFloat.subarray(i, end));

    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3DataChunks.push(new Uint8Array(mp3buf));
    }

    // Atualiza progresso de 55% a 95%
    const encodingProgress = 55 + Math.round((i / totalSamples) * 40);
    onProgress(encodingProgress, `Codificando MP3 192kbps 48kHz (${encodingProgress}%)...`);

    // Permite que o navegador renderize a barra de progresso do Toast sem travar a thread da UI
    if (i % (sampleBlockSize * 4) === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Finaliza a codificação do encoder
  const finalBuf = mp3encoder.flush();
  if (finalBuf.length > 0) {
    mp3DataChunks.push(new Uint8Array(finalBuf));
  }

  onProgress(100, 'Codificação finalizada com sucesso!');

  const blob = new Blob(mp3DataChunks as BlobPart[], { type: 'audio/mp3' });
  return { fileName, blob };
};
