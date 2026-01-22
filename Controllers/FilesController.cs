using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

// Пакеты для WebP (через NuGet):
// SixLabors.ImageSharp
// SixLabors.ImageSharp.Formats.Webp
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<FilesController> _logger;

        public FilesController(IWebHostEnvironment env, ILogger<FilesController> logger)
        {
            _env = env;
            _logger = logger;
        }

        /// <summary>
        /// Загрузка изображений, конвертация в WebP и возврат URL-ов
        /// </summary>
        [HttpPost("images")]
        [RequestSizeLimit(10_000_000)] // до ~10 МБ на запрос
        public async Task<IActionResult> UploadImages(
            [FromForm] List<IFormFile> images,
            CancellationToken cancellationToken)
        {
            if (images == null || images.Count == 0)
            {
                return BadRequest(new { message = "Файлы не получены." });
            }

            var uploadRoot = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadRoot))
            {
                Directory.CreateDirectory(uploadRoot);
            }

            var urls = new List<string>();

            foreach (var file in images)
            {
                try
                {
                    if (file == null || file.Length == 0)
                        continue;

                    if (!file.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                        continue;

                    // Уникальное имя файла
                    var fileName = Path.GetFileNameWithoutExtension(Path.GetRandomFileName());
                    var fullPath = Path.Combine(uploadRoot, fileName + ".webp");

                    await using var inputStream = file.OpenReadStream();
                    using var image = await Image.LoadAsync(inputStream, cancellationToken);
                    image.Mutate(x => x.AutoOrient());

                    var encoder = new WebpEncoder
                    {
                        Quality = 80
                    };

                    await using var output = System.IO.File.Create(fullPath);
                    await image.SaveAsWebpAsync(output, encoder, cancellationToken);

                    var url = "/uploads/" + Path.GetFileName(fullPath);
                    urls.Add(url);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка при обработке файла {FileName}", file.FileName);
                }
            }

            if (urls.Count == 0)
            {
                return BadRequest(new { message = "Не удалось сохранить изображения." });
            }

            return Ok(new { urls });
        }
    }
}
