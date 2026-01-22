using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication2.Data;
using WebApplication2.Dtos;
using WebApplication2.Models;      // проверь, здесь ли у тебя Post и PostDto
using WebApplication2.Services;
using System.Text.Json;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PostsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly PostStreamService _postStream;

        public PostsController(AppDbContext context, PostStreamService postStream)
        {
            _context = context;
            _postStream = postStream;
        }

        // GET: /api/posts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Post>>> GetPosts()
        {
            var posts = await _context.Posts
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            var hasAvatar = await HasUsersAvatarColumnAsync();
            var users = hasAvatar
                ? await _context.Users
                    .Select(u => new { u.Id, u.UserName, u.AvatarUrl })
                    .ToListAsync()
                : await _context.Users
                    .Select(u => new { u.Id, u.UserName, AvatarUrl = (string?)null })
                    .ToListAsync();

            var byId = users.ToDictionary(u => u.Id, u => u.AvatarUrl);
            var byName = users
                .Where(u => !string.IsNullOrWhiteSpace(u.UserName))
                .GroupBy(u => u.UserName.ToLower())
                .ToDictionary(g => g.Key, g => g.First().AvatarUrl);

            var result = posts.Select(p => MapPostWithAvatar(p, byId, byName));
            return Ok(result);
        }

        // GET: /api/posts/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<Post>> GetPostById(int id)
        {
            var post = await _context.Posts.FindAsync(id);

            if (post == null)
                return NotFound();

            var hasAvatar = await HasUsersAvatarColumnAsync();
            var users = hasAvatar
                ? await _context.Users
                    .Select(u => new { u.Id, u.UserName, u.AvatarUrl })
                    .ToListAsync()
                : await _context.Users
                    .Select(u => new { u.Id, u.UserName, AvatarUrl = (string?)null })
                    .ToListAsync();

            var byId = users.ToDictionary(u => u.Id, u => u.AvatarUrl);
            var byName = users
                .Where(u => !string.IsNullOrWhiteSpace(u.UserName))
                .GroupBy(u => u.UserName.ToLower())
                .ToDictionary(g => g.Key, g => g.First().AvatarUrl);

            return Ok(MapPostWithAvatar(post, byId, byName));
        }

        // POST: /api/posts
        [HttpPost]
        public async Task<ActionResult<Post>> CreatePost([FromBody] PostDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest("Нужно указать название.");

            if (string.IsNullOrWhiteSpace(dto.Text))
                return BadRequest("Нужно указать описание.");

            if (string.IsNullOrWhiteSpace(dto.ImagesJson))
                return BadRequest("Нужна хотя бы одна картинка.");

            try
            {
                var images = JsonSerializer.Deserialize<List<string>>(dto.ImagesJson);
                if (images == null || images.Count == 0)
                    return BadRequest("Нужна хотя бы одна картинка.");
            }
            catch
            {
                return BadRequest("Нужна хотя бы одна картинка.");
            }

            if (string.IsNullOrWhiteSpace(dto.Category))
                return BadRequest("Нужно выбрать категорию.");

            var post = new Post
            {
                AuthorId = dto.AuthorId ?? "anonymous",
                AuthorName = string.IsNullOrWhiteSpace(dto.AuthorName)
                             ? "Unknown"
                             : dto.AuthorName,
                Title = dto.Title,
                Text = dto.Text,
                Category = dto.Category,
                Subcategory = dto.Subcategory,
                ImagesJson = dto.ImagesJson,
                CreatedAt = DateTime.UtcNow
            };

            _context.Posts.Add(post);
            await _context.SaveChangesAsync();

            var avatarUrl = await ResolveAvatarUrlAsync(post);

            // 🔹 шлём событие во все открытые клиенты (SSE)
            await _postStream.BroadcastAsync(new
            {
                type = "created",
                post = MapPostWithAvatar(post, avatarUrl)
            });

            // вернём то же, что фронт ждёт
            return CreatedAtAction(nameof(GetPostById), new { id = post.Id }, MapPostWithAvatar(post, avatarUrl));
        }

        // PUT: /api/posts/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePost(int id, [FromBody] PostDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var post = await _context.Posts.FindAsync(id);
            if (post == null)
                return NotFound();

            post.Text = dto.Text;
            post.ImagesJson = dto.ImagesJson;
            post.Title = dto.Title;
            post.Category = dto.Category;
            post.Subcategory = dto.Subcategory;
            post.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var avatarUrl = await ResolveAvatarUrlAsync(post);

            await _postStream.BroadcastAsync(new
            {
                type = "updated",
                post = MapPostWithAvatar(post, avatarUrl)
            });

            return NoContent();
        }

        // DELETE: /api/posts/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePost(int id)
        {
            var post = await _context.Posts.FindAsync(id);
            if (post == null)
                return NotFound();

            _context.Posts.Remove(post);
            await _context.SaveChangesAsync();

            await _postStream.BroadcastAsync(new
            {
                type = "deleted",
                postId = id
            });

            return NoContent();
        }

        private static object MapPostWithAvatar(Post post, Dictionary<int, string?> byId, Dictionary<string, string?> byName)
        {
            string? avatarUrl = null;
            if (int.TryParse(post.AuthorId, out var uid) && byId.TryGetValue(uid, out var urlById))
            {
                avatarUrl = urlById;
            }
            else
            {
                var key = (post.AuthorName ?? "").ToLower();
                if (!string.IsNullOrWhiteSpace(key) && byName.TryGetValue(key, out var urlByName))
                {
                    avatarUrl = urlByName;
                }
            }

            return MapPostWithAvatar(post, avatarUrl);
        }

        private static object MapPostWithAvatar(Post post, string? avatarUrl)
        {
            return new
            {
                post.Id,
                post.AuthorId,
                post.AuthorName,
                post.Title,
                post.Text,
                post.Category,
                post.Subcategory,
                post.ImagesJson,
                post.CreatedAt,
                post.UpdatedAt,
                AuthorAvatarUrl = avatarUrl
            };
        }

        private async Task<string?> ResolveAvatarUrlAsync(Post post)
        {
            if (!await HasUsersAvatarColumnAsync())
            {
                return null;
            }

            if (int.TryParse(post.AuthorId, out var uid))
            {
                var userById = await _context.Users.FirstOrDefaultAsync(u => u.Id == uid);
                return userById?.AvatarUrl;
            }

            if (!string.IsNullOrWhiteSpace(post.AuthorName))
            {
                var userByName = await _context.Users.FirstOrDefaultAsync(u => u.UserName == post.AuthorName);
                return userByName?.AvatarUrl;
            }

            return null;
        }

        private async Task<bool> HasUsersAvatarColumnAsync()
        {
            try
            {
                var conn = _context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                {
                    await conn.OpenAsync();
                }

                using var cmd = conn.CreateCommand();
                cmd.CommandText = "PRAGMA table_info(Users);";
                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    var name = reader["name"]?.ToString();
                    if (string.Equals(name, "AvatarUrl", StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }
            catch
            {
                // если не получилось проверить — считаем, что колонки нет
            }

            return false;
        }
    }
}
