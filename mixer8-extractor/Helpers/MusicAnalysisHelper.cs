using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mixer8.Extractor.Helpers;

public class ChordBeatItem
{
    [JsonPropertyName("curr_beat_time")]
    public double CurrBeatTime { get; set; }

    [JsonPropertyName("chord_simple_pop")]
    public string? ChordSimplePop { get; set; }

    [JsonPropertyName("prev_chord")]
    public string? PrevChord { get; set; }
}

public static class MusicAnalysisHelper
{
    // Escala temperada normalizada com a convenção do músico:
    // Sustenidos em C# e F# | Bemóis em Eb, Ab, Bb
    private static readonly string[] DisplayRootNames = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

    public static (int? Bpm, string? Key) AnalyzeChordsJson(string jsonContent)
    {
        if (string.IsNullOrWhiteSpace(jsonContent)) return (null, null);

        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var beats = JsonSerializer.Deserialize<List<ChordBeatItem>>(jsonContent, options);
            if (beats == null || beats.Count < 2) return (null, null);

            // 1. Calcular BPM Base
            int? bpm = CalculateBpm(beats);

            // 2. Calcular Tonalidade Base (Key) com Análise de Cadências V -> I e Frequência Harmônica
            string? key = DetectKey(beats);

            return (bpm, key);
        }
        catch
        {
            return (null, null);
        }
    }

    private static int? CalculateBpm(List<ChordBeatItem> beats)
    {
        var deltas = new List<double>();
        for (int i = 0; i < beats.Count - 1; i++)
        {
            double delta = beats[i + 1].CurrBeatTime - beats[i].CurrBeatTime;
            if (delta >= 0.2 && delta <= 2.5)
            {
                deltas.Add(delta);
            }
        }

        if (deltas.Count == 0) return null;

        double avgDelta = deltas.Average();
        if (avgDelta <= 0) return null;

        int calculatedBpm = (int)Math.Round(60.0 / avgDelta);
        return calculatedBpm is >= 30 and <= 300 ? calculatedBpm : null;
    }

    private static string? DetectKey(List<ChordBeatItem> beats)
    {
        var parsedBeats = new List<(int RootIndex, bool IsMinor, string Raw)>();
        foreach (var b in beats)
        {
            var rawName = !string.IsNullOrWhiteSpace(b.ChordSimplePop) && b.ChordSimplePop != "N"
                ? b.ChordSimplePop
                : b.PrevChord;

            if (string.IsNullOrWhiteSpace(rawName) || rawName == "N") continue;

            var parsed = ParseChord(rawName);
            if (parsed.HasValue)
            {
                parsedBeats.Add((parsed.Value.RootIndex, parsed.Value.IsMinor, rawName));
            }
        }

        if (parsedBeats.Count == 0) return null;

        var chordTransitions = new List<((int RootIndex, bool IsMinor) From, (int RootIndex, bool IsMinor) To)>();
        for (int i = 0; i < parsedBeats.Count - 1; i++)
        {
            var current = (parsedBeats[i].RootIndex, parsedBeats[i].IsMinor);
            var next = (parsedBeats[i + 1].RootIndex, parsedBeats[i + 1].IsMinor);
            if (current.RootIndex != next.RootIndex || current.IsMinor != next.IsMinor)
            {
                chordTransitions.Add((current, next));
            }
        }

        double totalBeats = parsedBeats.Count;
        string bestKey = "C";
        double maxScore = -9999;

        for (int rootIdx = 0; rootIdx < 12; rootIdx++)
        {
            double majorScore = EvaluateKeyCandidate(rootIdx, isMinorKey: false, parsedBeats, chordTransitions, totalBeats);
            if (majorScore > maxScore)
            {
                maxScore = majorScore;
                bestKey = DisplayRootNames[rootIdx];
            }

            double minorScore = EvaluateKeyCandidate(rootIdx, isMinorKey: true, parsedBeats, chordTransitions, totalBeats);
            if (minorScore > maxScore)
            {
                maxScore = minorScore;
                bestKey = $"{DisplayRootNames[rootIdx]}m";
            }
        }

        return bestKey;
    }

    private static double EvaluateKeyCandidate(
        int keyRoot,
        bool isMinorKey,
        List<(int RootIndex, bool IsMinor, string Raw)> parsedBeats,
        List<((int RootIndex, bool IsMinor) From, (int RootIndex, bool IsMinor) To)> chordTransitions,
        double totalBeats)
    {
        var field = new HashSet<(int RootIndex, bool IsMinor)>();
        (int RootIndex, bool IsMinor) tonic = (keyRoot, isMinorKey);
        (int RootIndex, bool IsMinor) dominantMaj = ((keyRoot + 7) % 12, false);
        (int RootIndex, bool IsMinor) subdominant = isMinorKey ? ((keyRoot + 5) % 12, true) : ((keyRoot + 5) % 12, false);

        if (!isMinorKey)
        {
            field.Add((keyRoot, false));
            field.Add(((keyRoot + 2) % 12, true));
            field.Add(((keyRoot + 4) % 12, true));
            field.Add(((keyRoot + 5) % 12, false));
            field.Add(((keyRoot + 7) % 12, false));
            field.Add(((keyRoot + 7) % 12, true));
            field.Add(((keyRoot + 9) % 12, true));
            field.Add(((keyRoot + 11) % 12, true));
        }
        else
        {
            field.Add((keyRoot, true));
            field.Add(((keyRoot + 2) % 12, true));
            field.Add(((keyRoot + 3) % 12, false));
            field.Add(((keyRoot + 5) % 12, true));
            field.Add(((keyRoot + 7) % 12, true));
            field.Add(((keyRoot + 7) % 12, false));
            field.Add(((keyRoot + 8) % 12, false));
            field.Add(((keyRoot + 10) % 12, false));
        }

        double score = 0;
        int beatsOnTonic = 0;

        foreach (var b in parsedBeats)
        {
            var chord = (b.RootIndex, b.IsMinor);
            if (chord.RootIndex == tonic.RootIndex && chord.IsMinor == tonic.IsMinor)
            {
                score += 3.0;
                beatsOnTonic++;
            }
            else if (field.Contains(chord))
            {
                score += 1.5;
            }
            else if (field.Any(f => f.RootIndex == chord.RootIndex))
            {
                score += 0.5;
            }
            else
            {
                score -= 2.0;
            }
        }

        if (beatsOnTonic == 0)
        {
            score -= 50.0;
        }
        else
        {
            score += (beatsOnTonic / totalBeats) * 20.0;
        }

        foreach (var tr in chordTransitions)
        {
            bool isFromDominant = tr.From.RootIndex == dominantMaj.RootIndex;
            bool isToTonic = tr.To.RootIndex == tonic.RootIndex && tr.To.IsMinor == tonic.IsMinor;

            if (isFromDominant && isToTonic)
            {
                score += 25.0;
            }

            bool isFromSubdominant = tr.From.RootIndex == subdominant.RootIndex;
            if (isFromSubdominant && isToTonic)
            {
                score += 10.0;
            }
        }

        var firstBeat = parsedBeats.First();
        if (firstBeat.RootIndex == tonic.RootIndex && firstBeat.IsMinor == tonic.IsMinor)
        {
            score += 8.0;
        }
        else if (firstBeat.RootIndex == tonic.RootIndex)
        {
            score += 4.0;
        }

        return score;
    }

    private static (int RootIndex, bool IsMinor)? ParseChord(string chord)
    {
        if (string.IsNullOrWhiteSpace(chord) || chord == "N") return null;

        string clean = chord.Trim();
        bool isMinor = clean.Contains(":min", StringComparison.OrdinalIgnoreCase) ||
                       (clean.Contains('m') && !clean.Contains("maj", StringComparison.OrdinalIgnoreCase));

        string root = clean;
        int colonIdx = root.IndexOf(':');
        if (colonIdx > 0)
        {
            root = root[..colonIdx];
        }

        if (root.Length > 1 && (root[1] == '#' || root[1] == 'b'))
        {
            root = root[..2];
        }
        else if (root.Length > 0)
        {
            root = root[..1];
        }

        int rootIdx = NormalizeRoot(root);
        if (rootIdx == -1) return null;

        return (rootIdx, isMinor);
    }

    private static int NormalizeRoot(string root)
    {
        return root.ToUpperInvariant() switch
        {
            "C" => 0,
            "C#" or "DB" => 1,
            "D" => 2,
            "D#" or "EB" => 3,
            "E" => 4,
            "F" => 5,
            "F#" or "GB" => 6,
            "G" => 7,
            "G#" or "AB" => 8,
            "A" => 9,
            "A#" or "BB" => 10,
            "B" => 11,
            _ => -1
        };
    }
}
