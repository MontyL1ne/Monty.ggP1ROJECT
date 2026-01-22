using Microsoft.EntityFrameworkCore;
using WebApplication2.Models;

namespace WebApplication2.Data
{
    public class AppDbContext : DbContext
    {
        public DbSet<UserAccount> Users { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<Post> Posts { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Post>(entity =>
            {
                entity.Property(p => p.AuthorId)
                      .IsRequired();

                entity.Property(p => p.AuthorName)
                      .IsRequired()
                      .HasMaxLength(100);

                entity.Property(p => p.Text)
                      .IsRequired()
                      .HasMaxLength(1200);

                entity.Property(p => p.Title)
                      .IsRequired()
                      .HasMaxLength(120);

                entity.Property(p => p.Category)
                      .IsRequired()
                      .HasMaxLength(100);

                entity.Property(p => p.Subcategory)
                      .HasMaxLength(100);

                entity.Property(p => p.CreatedAt)
                      .HasDefaultValueSql("CURRENT_TIMESTAMP");
            });

            modelBuilder.Entity<UserAccount>(entity =>
            {
                entity.HasIndex(u => u.UserName).IsUnique();
                entity.HasIndex(u => u.Email).IsUnique();

                entity.Property(u => u.UserName)
                      .IsRequired()
                      .HasMaxLength(50);

                entity.Property(u => u.Email)
                      .IsRequired()
                      .HasMaxLength(100);

                entity.Property(u => u.PasswordHash)
                      .IsRequired();
            });
        }

    }
}
