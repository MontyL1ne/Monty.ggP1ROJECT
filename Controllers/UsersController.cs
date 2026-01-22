using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication2.Data;
using System.IO;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public UsersController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<object>> GetUser(int id)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            return Ok(new
            {
                id = user.Id,
                userName = user.UserName,
                email = user.Email,
                avatarUrl = user.AvatarUrl
            });
        }

        [HttpPost("{id:int}/avatar")]
        public async Task<ActionResult<object>> UploadAvatar(int id, IFormFile avatar)
        {
            if (avatar == null || avatar.Length == 0)
                return BadRequest("Файл не найден.");

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);
            if (user == null) return NotFound();

            var ext = Path.GetExtension(avatar.FileName);
            if (string.IsNullOrWhiteSpace(ext))
            {
                ext = ".jpg";
            }

            var avatarsDir = Path.Combine(_env.ContentRootPath, "uploads", "avatars");
            if (!Directory.Exists(avatarsDir))
            {
                Directory.CreateDirectory(avatarsDir);
            }

            var fileName = $"{id}{ext}".ToLowerInvariant();
            var filePath = Path.Combine(avatarsDir, fileName);

            await using (var stream = System.IO.File.Create(filePath))
            {
                await avatar.CopyToAsync(stream);
            }

            var url = $"/uploads/avatars/{fileName}";
            user.AvatarUrl = url;
            await _db.SaveChangesAsync();

            return Ok(new { url });
        }
    }
}
