namespace WebApplication2.Models.Dto
{
    public class AuthResponse
    {
        public bool Success { get; set; }
        public string? Message { get; set; }

        public int? UserId { get; set; }
        public string? UserName { get; set; }
    }
}
