using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApplication2.Data;
using WebApplication2.Models;
using WebApplication2.Models.Dto;
using WebApplication2.Services;

namespace WebApplication2.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;

        public AuthController(AppDbContext db)
        {
            _db = db;
        }

        [HttpPost("register")]
        public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserName) ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Все поля обязательны"
                });
            }

            if (request.Password.Length < 6)
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Пароль должен быть не короче 6 символов"
                });
            }

            bool userExists = await _db.Users
                .AnyAsync(u => u.UserName == request.UserName || u.Email == request.Email);

            if (userExists)
            {
                return Conflict(new AuthResponse
                {
                    Success = false,
                    Message = "Пользователь с таким логином или email уже существует"
                });
            }

            var user = new UserAccount
            {
                UserName = request.UserName,
                Email = request.Email,
                PasswordHash = PasswordHasher.HashPassword(request.Password)
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Аккаунт успешно создан",
                UserId = user.Id,
                UserName = user.UserName
            });
        }

        // вход

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.UserNameOrEmail) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new AuthResponse
                {
                    Success = false,
                    Message = "Укажите логин/email и пароль"
                });
            }

            // Ищем по логину или email
            var user = await _db.Users
                .FirstOrDefaultAsync(u =>
                    u.UserName == request.UserNameOrEmail ||
                    u.Email == request.UserNameOrEmail);

            if (user == null)
            {
                return Unauthorized(new AuthResponse
                {
                    Success = false,
                    Message = "Неверный логин/email или пароль"
                });
            }

            bool passwordValid = PasswordHasher.VerifyPassword(
                request.Password,
                user.PasswordHash
            );

            if (!passwordValid)
            {
                return Unauthorized(new AuthResponse
                {
                    Success = false,
                    Message = "Неверный логин/email или пароль"
                });
            }
            
            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Успешный вход",
                UserId = user.Id,
                UserName = user.UserName
            });
        }
    }
}
