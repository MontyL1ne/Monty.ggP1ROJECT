using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication2.Data;
using WebApplication2.Models;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FavoritesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public FavoritesController(AppDbContext db)
        {
            _db = db;
        }

        [HttpGet("{userId:int}")]
        public async Task<ActionResult<IEnumerable<object>>> GetFavorites(int userId)
        {
            var favoritePostIds = await _db.Favorites
                .Where(f => f.UserId == userId)
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => f.PostId)
                .ToListAsync();

            if (!favoritePostIds.Any())
            {
                return Ok(Array.Empty<object>());
            }

            var posts = await _db.Posts
                .Where(p => favoritePostIds.Contains(p.Id))
                .ToListAsync();

            var hasAvatar = await HasUsersAvatarColumnAsync();
            var users = hasAvatar
                ? await _db.Users
                    .Select(u => new { u.Id, u.UserName, u.AvatarUrl })
                    .ToListAsync()
                : await _db.Users
                    .Select(u => new { u.Id, u.UserName, AvatarUrl = (string?)null })
                    .ToListAsync();

            var byId = users.ToDictionary(u => u.Id, u => u.AvatarUrl);
            var byName = users
                .Where(u => !string.IsNullOrWhiteSpace(u.UserName))
                .GroupBy(u => u.UserName.ToLower())
                .ToDictionary(g => g.Key, g => g.First().AvatarUrl);

            var ordered = favoritePostIds
                .Select(id => posts.FirstOrDefault(p => p.Id == id))
                .Where(p => p != null)
                .Select(p => MapPostWithAvatar(p!, byId, byName));

            return Ok(ordered);
        }

        [HttpGet("{userId:int}/contains/{postId:int}")]
        public async Task<ActionResult<bool>> Contains(int userId, int postId)
        {
            var exists = await _db.Favorites.AnyAsync(f => f.UserId == userId && f.PostId == postId);
            return Ok(exists);
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] FavoriteRequest request)
        {
            if (request.UserId <= 0 || request.PostId <= 0)
                return BadRequest();

            var exists = await _db.Favorites.AnyAsync(f => f.UserId == request.UserId && f.PostId == request.PostId);
            if (exists) return Ok();

            _db.Favorites.Add(new Favorite
            {
                UserId = request.UserId,
                PostId = request.PostId,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();

            return Ok();
        }

        [HttpDelete("{userId:int}/{postId:int}")]
        public async Task<IActionResult> Remove(int userId, int postId)
        {
            var fav = await _db.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.PostId == postId);
            if (fav == null) return NotFound();

            _db.Favorites.Remove(fav);
            await _db.SaveChangesAsync();
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

        private async Task<bool> HasUsersAvatarColumnAsync()
        {
            try
            {
                var conn = _db.Database.GetDbConnection();
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
                // ignore
            }
            return false;
        }

        public class FavoriteRequest
        {
            public int UserId { get; set; }
            public int PostId { get; set; }
        }
    }
}
