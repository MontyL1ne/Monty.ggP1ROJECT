using System;

namespace WebApplication2.Models
{
    public class Favorite
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public int PostId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
