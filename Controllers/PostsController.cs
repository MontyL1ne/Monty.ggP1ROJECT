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

            return Ok(posts);
        }

        // GET: /api/posts/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<Post>> GetPostById(int id)
        {
            var post = await _context.Posts.FindAsync(id);

            if (post == null)
                return NotFound();

            return post;
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

            // 🔹 шлём событие во все открытые клиенты (SSE)
            await _postStream.BroadcastAsync(new
            {
                type = "created",
                post
            });

            // вернём то же, что фронт ждёт
            return CreatedAtAction(nameof(GetPostById), new { id = post.Id }, post);
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

            await _postStream.BroadcastAsync(new
            {
                type = "updated",
                post
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
    }
}
