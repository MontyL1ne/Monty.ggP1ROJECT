using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")] // => /api/uploads
    public class UploadsController : ControllerBase
    {
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<UploadsController> _logger;

        public UploadsController(IWebHostEnvironment env, ILogger<UploadsController> logger)
        {
            _env = env;
            _logger = logger;
        }

        // POST /api/uploads
        [HttpPost]
        [RequestSizeLimit(20L * 1024 * 1024)] // до 20 MB
        public async Task<ActionResult<List<string>>> Upload()
        {
            var files = Request.Form.Files;

            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "Файлы не получены (Request.Form.Files пуст)." });
            }

            var uploadsRoot = Path.Combine(_env.ContentRootPath, "uploads");
            if (!Directory.Exists(uploadsRoot))
                Directory.CreateDirectory(uploadsRoot);

            var resultUrls = new List<string>();

            foreach (var file in files)
            {
                if (file.Length == 0) continue;

                try
                {
                    var newFileName = $"{Guid.NewGuid():N}.webp";
                    var filePath = Path.Combine(uploadsRoot, newFileName);

                    using var image = await Image.LoadAsync(file.OpenReadStream());
                    image.Mutate(x => x.AutoOrient());
                    var encoder = new WebpEncoder
                    {
                        Quality = 80
                    };

                    await image.SaveAsWebpAsync(filePath, encoder);

                    var urlPath = $"/uploads/{newFileName}".Replace("\\", "/");
                    resultUrls.Add(urlPath);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Ошибка при обработке файла {FileName}", file.FileName);
                }
            }

            if (resultUrls.Count == 0)
            {
                return StatusCode(500, new { message = "Не удалось сохранить ни один файл." });
            }

            return Ok(resultUrls);
        }
    }
}
