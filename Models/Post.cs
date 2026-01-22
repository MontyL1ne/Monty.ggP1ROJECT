using System;
using System.ComponentModel.DataAnnotations;

namespace WebApplication2.Models
{
    public class Post
    {
        public int Id { get; set; }

        [Required]
        public string AuthorId { get; set; } = "anonymous";

        [Required]
        [MaxLength(100)]
        public string AuthorName { get; set; } = "Unknown";

        [Required]
        [MaxLength(120)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(1200)]
        public string Text { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Subcategory { get; set; }

        public string? ImagesJson { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }
}
