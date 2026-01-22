namespace WebApplication2.Models.Dto
{
    public class LoginRequest
    {
        public string UserNameOrEmail { get; set; } = null!;
        public string Password { get; set; } = null!;
    }
}
