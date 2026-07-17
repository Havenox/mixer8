import lameCode from 'lamejs/lame.all.js?raw';
import { transposeChord } from '../hooks/useLyricsChords';
import { type ITrack, isMetronomeStem } from '../context/PlayerContext';
import { SERVER_URL } from '../config';
import { addID3v2Tags } from './id3Writer';

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

let cachedMp3EncoderClass: any = null;

const getMp3EncoderClass = (): any => {
  if (cachedMp3EncoderClass) {
    return cachedMp3EncoderClass;
  }
  if (typeof window !== 'undefined' && (window as any).lamejs?.Mp3Encoder) {
    cachedMp3EncoderClass = (window as any).lamejs.Mp3Encoder;
    return cachedMp3EncoderClass;
  }

  try {
    // Executa o bundle IIFE limpo de lame.all.js injetando window/globalThis
    const evalFn = new Function('window', 'globalThis', `
      ${lameCode}
      if (typeof lamejs !== 'undefined') {
        window.lamejs = lamejs;
        globalThis.lamejs = lamejs;
        return lamejs;
      }
      return null;
    `);
    const lameObj = evalFn(window, globalThis);
    if (lameObj?.Mp3Encoder) {
      cachedMp3EncoderClass = lameObj.Mp3Encoder;
      return cachedMp3EncoderClass;
    }
  } catch (err) {
    console.warn('[EXPORT] Erro ao avaliar bundle lame.all.js:', err);
  }

  if (typeof window !== 'undefined' && (window as any).lamejs?.Mp3Encoder) {
    cachedMp3EncoderClass = (window as any).lamejs.Mp3Encoder;
    return cachedMp3EncoderClass;
  }

  throw new Error('Não foi possível carregar o codificador MP3 (lamejs).');
};

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
  const tempoRatio = calculatedBpm / baseBpm;
  const musicalSpeedRatio = tempoRatio * Math.pow(2, transpose / 12);

  // Calcula a transposição induzida pela velocidade e os desvios necessários para o processador WASM
  const transposeFromSpeed = 12 * Math.log2(tempoRatio);
  const musicWorkletTranspose = transpose - transposeFromSpeed;
  const metronomeWorkletTranspose = -transposeFromSpeed;

  // Determina se usaremos o Pitch Shifter WASM (Signalsmith Stretch) offline
  let useWasmPitchShift = false;
  let wasmModule: WebAssembly.Module | null = null;
  if (transpose !== 0 || Math.abs(transposeFromSpeed) > 0.01) {
    try {
      const wasmRes = await fetch('/wasm/signalsmith-stretch.wasm');
      if (wasmRes.ok) {
        const wasmBuffer = await wasmRes.arrayBuffer();
        wasmModule = await WebAssembly.compile(wasmBuffer);
        useWasmPitchShift = true;
      }
    } catch (err) {
      console.warn('[EXPORT-WASM] Falha ao compilar WASM para exportação. Usando fallback de resample.', err);
    }
  }

  let maxDuration = 0;
  for (const { stemType, buffer } of stemBuffers) {
    const isMetronome = isMetronomeStem(stemType);
    // Se estiver usando o Pitch Shift via WASM, a velocidade harmônica não é acelerada pelo tom
    const effectiveSpeedRatio = (isMetronome || useWasmPitchShift) ? tempoRatio : musicalSpeedRatio;
    const adjustedDuration = buffer.duration / effectiveSpeedRatio;
    if (adjustedDuration > maxDuration) {
      maxDuration = adjustedDuration;
    }
  }

  if (useWasmPitchShift) {
    maxDuration += 0.12; // Compensação de latência do processador (120ms)
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

  // Configuração dos nós AudioWorklet de Pitch Shifter
  let pitchWorkletNode: AudioWorkletNode | null = null;
  let metronomePitchNode: AudioWorkletNode | null = null;

  if (useWasmPitchShift && wasmModule) {
    try {
      await offlineCtx.audioWorklet.addModule('/wasm/pitch-shift-processor.js?v=' + Date.now());
      
      // Cria o nó de afinação para as pistas musicais
      pitchWorkletNode = new AudioWorkletNode(offlineCtx, 'pitch-shift-processor', {
        processorOptions: { wasmModule, transpose: musicWorkletTranspose, forceProcess: true },
        outputChannelCount: [2]
      });
      pitchWorkletNode.connect(masterGain);

      // Cria o nó de afinação para o metrônomo para anular a alteração de tom do resample
      if (Math.abs(metronomeWorkletTranspose) > 0.01) {
        metronomePitchNode = new AudioWorkletNode(offlineCtx, 'pitch-shift-processor', {
          processorOptions: { wasmModule, transpose: metronomeWorkletTranspose, forceProcess: true },
          outputChannelCount: [2]
        });
        metronomePitchNode.connect(masterGain);
      }
    } catch (err) {
      console.error('[EXPORT-WASM] Falha ao registrar AudioWorklet WASM na OfflineCtx. Usando fallback de resample.', err);
      useWasmPitchShift = false;
      pitchWorkletNode = null;
      metronomePitchNode = null;
    }
  }

  for (const { stemType, buffer } of stemBuffers) {
    const vol = stemsVolume[stemType] ?? 1.0;
    const muted = stemsMute[stemType] ?? false;
    const solo = stemsSolo[stemType] ?? false;
    const pan = stemsPan[stemType] ?? 0.0;

    const effectiveGain = (muted || (hasAnySolo && !solo)) ? 0.0 : vol;
    if (effectiveGain <= 0) continue; // Pista silenciada

    const isMetronome = isMetronomeStem(stemType);
    const effectiveSpeedRatio = (isMetronome || useWasmPitchShift) ? tempoRatio : musicalSpeedRatio;

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = effectiveSpeedRatio;

    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = effectiveGain;

    const pannerNode = offlineCtx.createStereoPanner();
    pannerNode.pan.value = Math.max(-1, Math.min(1, pan));

    source.connect(gainNode);
    gainNode.connect(pannerNode);

    if (isMetronome) {
      if (useWasmPitchShift) {
        if (metronomePitchNode) {
          // Se o metrônomo possui seu próprio processador de tom (que já possui a latência de 120ms)
          pannerNode.connect(metronomePitchNode);
        } else {
          // Se não há processador de tom no metrônomo (não necessitou transposição de velocidade), atrasamos em 120ms para sincronizar
          const delayNode = offlineCtx.createDelay(1.0);
          delayNode.delayTime.value = 0.12;
          pannerNode.connect(delayNode);
          delayNode.connect(masterGain);
        }
      } else {
        pannerNode.connect(masterGain);
      }
    } else {
      if (useWasmPitchShift && pitchWorkletNode) {
        pannerNode.connect(pitchWorkletNode);
      } else {
        pannerNode.connect(masterGain);
      }
    }

    source.start(0);
  }

  // 5. Renderiza a mixagem offline
  onProgress(45, 'Renderizando mixagem offline em 48kHz...');
  const renderedAudioBuffer = await offlineCtx.startRendering();

  // 6. Codificação PCM Float32 -> MP3 192 kbps 48 kHz usando lamejs
  onProgress(55, 'Codificando MP3 192kbps 48kHz...');

  const Mp3Encoder = getMp3EncoderClass();
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

  // 7. Anexa Metadados ID3v2 (Título, Artista, Álbum e Capa cover.webp)
  onProgress(98, 'Anexando capa e metadados ID3v2 ao MP3...');

  let coverImageBuffer: ArrayBuffer | null = null;
  let coverMimeType = 'image/webp';

  if (currentTrack.CoverUrl) {
    try {
      const fullCoverUrl = currentTrack.CoverUrl.startsWith('http')
        ? currentTrack.CoverUrl
        : `${SERVER_URL}${currentTrack.CoverUrl}`;
      const coverRes = await fetch(fullCoverUrl);
      if (coverRes.ok) {
        coverImageBuffer = await coverRes.arrayBuffer();
        if (currentTrack.CoverUrl.endsWith('.png')) coverMimeType = 'image/png';
        else if (currentTrack.CoverUrl.endsWith('.jpg') || currentTrack.CoverUrl.endsWith('.jpeg')) coverMimeType = 'image/jpeg';
      }
    } catch (err) {
      console.warn('[EXPORT] Não foi possível carregar a capa para a tag ID3v2:', err);
    }
  }

  const rawBlob = new Blob(mp3DataChunks as BlobPart[], { type: 'audio/mp3' });
  const taggedBlob = await addID3v2Tags(rawBlob, {
    title: currentTrack.TrackTitle,
    artist: currentTrack.ArtistName,
    album: 'Mixer8 DAW',
    coverImageBuffer,
    mimeType: coverMimeType
  });

  onProgress(100, 'Codificação finalizada com sucesso!');

  return { fileName, blob: taggedBlob };
};
