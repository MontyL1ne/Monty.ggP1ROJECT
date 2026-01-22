using System.Security.Cryptography;
using System.Text;

namespace WebApplication2.Services
{
    public static class PasswordHasher
    {
        // Возвращаем "salt:hash" в Base64
        public static string HashPassword(string password)
        {
            // длину соли/ключа можно менять
            byte[] salt = RandomNumberGenerator.GetBytes(16);

            using var pbkdf2 = new Rfc2898DeriveBytes(
                password,
                salt,
                100_000, // итерации
                HashAlgorithmName.SHA256);

            byte[] hash = pbkdf2.GetBytes(32);

            // Склеиваем "salt:hash" в Base64
            return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
        }

        public static bool VerifyPassword(string password, string storedHash)
        {
            var parts = storedHash.Split(':');
            if (parts.Length != 2)
                return false;

            byte[] salt = Convert.FromBase64String(parts[0]);
            byte[] hash = Convert.FromBase64String(parts[1]);

            using var pbkdf2 = new Rfc2898DeriveBytes(
                password,
                salt,
                100_000,
                HashAlgorithmName.SHA256);

            byte[] computed = pbkdf2.GetBytes(32);

            return CryptographicOperations.FixedTimeEquals(computed, hash);
        }
    }
}
