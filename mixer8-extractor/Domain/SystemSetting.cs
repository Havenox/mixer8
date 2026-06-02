using System;

namespace Mixer8.Extractor.Domain;

/// <summary>
/// Representa configurações dinâmicas globais parametrizadas do sistema.
/// </summary>
public class SystemSetting
{
    public string Key { get; set; } = null!;
    public string Value { get; set; } = null!;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
