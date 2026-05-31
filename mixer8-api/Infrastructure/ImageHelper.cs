using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Webp;

namespace Mixer8.Api.Infrastructure;

/// <summary>
/// Utilitário estático para processamento e compressão inteligente de imagens usando SixLabors.ImageSharp.
/// Executa o corte quadrado centralizado (crop 1:1) e codifica para o formato WebP com 80% de qualidade.
/// </summary>
public static class ImageHelper
{
    /// <summary>
    /// Processa uma imagem recebida via upload: executa o crop 1:1 centralizado,
    /// comprime para o formato WebP com 80% de qualidade e salva no disco.
    /// </summary>
    /// <param name="file">O arquivo de imagem enviado pela requisição HTTP.</param>
    /// <param name="destinationPath">O caminho físico absoluto onde o arquivo .webp comprimido será salvo.</param>
    public static async Task ProcessAndSaveImageAsync(IFormFile file, string destinationPath)
    {
        if (file == null) throw new ArgumentNullException(nameof(file));
        if (string.IsNullOrWhiteSpace(destinationPath)) throw new ArgumentException("O caminho de destino não pode ser vazio.", nameof(destinationPath));

        using var inputStream = file.OpenReadStream();
        using var image = await Image.LoadAsync(inputStream);

        // 1. Corte quadrado centralizado (crop 1:1)
        int minDim = Math.Min(image.Width, image.Height);
        int x = (image.Width - minDim) / 2;
        int y = (image.Height - minDim) / 2;

        image.Mutate(ctx => ctx.Crop(new Rectangle(x, y, minDim, minDim)));

        // 2. Redimensionamento para limitar a resolução máxima a 500x500 pixels se for maior
        if (image.Width > 500)
        {
            image.Mutate(ctx => ctx.Resize(500, 500));
        }

        // 3. Configuração do Encoder WebP com 80% de qualidade
        var encoder = new WebpEncoder
        {
            Quality = 80
        };

        // Garante a existência do diretório pai físico
        var directory = Path.GetDirectoryName(destinationPath);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        // Salva a imagem processada de forma assíncrona no disco
        await image.SaveAsync(destinationPath, encoder);
    }
}
