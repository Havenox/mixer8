using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Mixer8.Api.Helpers;

public class ChordBeatItem
{
    [JsonPropertyName("curr_beat_time")]
    public double CurrBeatTime { get; set; }

    [JsonPropertyName("chord_simple_pop")]
    public string? ChordSimplePop { get; set; }
}

public static class MusicAnalysisHelper
{
    private static readonly string[] RootNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

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

            // 2. Calcular Tonalidade Base (Key)
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
        var rawChords = beats
            .Select(b => b.ChordSimplePop)
            .Where(c => !string.IsNullOrWhiteSpace(c) && c != "N")
            .Distinct()
            .Take(12)
            .ToList();

        if (rawChords.Count == 0) return null;

        var parsedChords = new List<(int RootIndex, bool IsMinor)>();
        foreach (var raw in rawChords)
        {
            var parsed = ParseChord(raw!);
            if (parsed.HasValue)
            {
                parsedChords.Add(parsed.Value);
            }
        }

        if (parsedChords.Count == 0) return rawChords.First();

        string bestKey = rawChords.First()!;
        int maxScore = -1;

        for (int rootIdx = 0; rootIdx < 12; rootIdx++)
        {
            int majorScore = ScoreKey(rootIdx, isMinor: false, parsedChords);
            if (majorScore > maxScore)
            {
                maxScore = majorScore;
                bestKey = RootNames[rootIdx];
            }

            int minorScore = ScoreKey(rootIdx, isMinor: true, parsedChords);
            if (minorScore > maxScore)
            {
                maxScore = minorScore;
                bestKey = $"{RootNames[rootIdx]}m";
            }
        }

        return bestKey;
    }

    private static (int RootIndex, bool IsMinor)? ParseChord(string chord)
    {
        if (string.IsNullOrWhiteSpace(chord) || chord == "N") return null;

        string clean = chord.Trim();
        bool isMinor = clean.Contains('m') && !clean.Contains("maj");

        string root = clean;
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

    private static int ScoreKey(int rootIdx, bool isMinor, List<(int RootIndex, bool IsMinor)> chords)
    {
        HashSet<(int RootIndex, bool IsMinor)> field = new();

        if (!isMinor)
        {
            field.Add((rootIdx, false));
            field.Add(((rootIdx + 2) % 12, true));
            field.Add(((rootIdx + 4) % 12, true));
            field.Add(((rootIdx + 5) % 12, false));
            field.Add(((rootIdx + 7) % 12, false));
            field.Add(((rootIdx + 9) % 12, true));
            field.Add(((rootIdx + 11) % 12, true));
        }
        else
        {
            field.Add((rootIdx, true));
            field.Add(((rootIdx + 2) % 12, true));
            field.Add(((rootIdx + 3) % 12, false));
            field.Add(((rootIdx + 5) % 12, true));
            field.Add(((rootIdx + 7) % 12, true));
            field.Add(((rootIdx + 7) % 12, false));
            field.Add(((rootIdx + 8) % 12, false));
            field.Add(((rootIdx + 10) % 12, false));
        }

        int score = 0;
        foreach (var c in chords)
        {
            if (field.Contains(c))
            {
                score += 2;
            }
            else if (field.Any(f => f.RootIndex == c.RootIndex))
            {
                score += 1;
            }
        }

        if (chords.Count > 0 && chords[0].RootIndex == rootIdx)
        {
            score += 1;
        }

        return score;
    }
}
