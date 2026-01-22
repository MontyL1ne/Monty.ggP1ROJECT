using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using WebApplication2.Data;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WebApplication2.Services;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Data;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    WebRootPath = "wwwroot"
});

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// DbContext
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=app.db"));

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .WithExposedHeaders("X-Total-Count");
        });
});

// 🔹 сервис для SSE-потока постов
builder.Services.AddSingleton<PostStreamService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();

    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    //app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseRouting();

app.UseCors();

// wwwroot
app.UseStaticFiles();

var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseAuthorization();

// 🔹 SSE-эндпоинт для live-ленты постов
app.MapGet("/api/posts/stream", async (HttpContext context, PostStreamService stream) =>
{
    context.Response.Headers.Add("Content-Type", "text/event-stream");
    context.Response.Headers.Add("Cache-Control", "no-cache");
    context.Response.Headers.Add("X-Accel-Buffering", "no");

    var (clientId, reader) = stream.RegisterClient();

    try
    {
        await foreach (var json in reader.ReadAllAsync(context.RequestAborted))
        {
            await context.Response.WriteAsync($"data: {json}\n\n");
            await context.Response.Body.FlushAsync();
        }
    }
    catch (OperationCanceledException)
    {
        // клиент отключился — нормально
    }
    finally
    {
        stream.UnregisterClient(clientId);
    }
});

app.MapControllers();

app.MapFallbackToFile("/pages/index.html");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var conn = db.Database.GetDbConnection();
    conn.Open();

    bool hasMigrationsHistory = false;
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='__EFMigrationsHistory';";
        hasMigrationsHistory = cmd.ExecuteScalar() != null;
    }

    bool hasPostsTable = false;
    using (var cmd = conn.CreateCommand())
    {
        cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='Posts';";
        hasPostsTable = cmd.ExecuteScalar() != null;
    }

    if (hasMigrationsHistory && !hasPostsTable)
    {
        db.Database.Migrate();
    }
    else
    {
        db.Database.EnsureCreated();

        using var pragmaCmd = conn.CreateCommand();
        pragmaCmd.CommandText = "PRAGMA table_info(Posts);";
        using var reader = pragmaCmd.ExecuteReader();

        var cols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
        {
            cols.Add(reader["name"].ToString() ?? string.Empty);
        }

        void AddColumnIfMissing(string name, string sqlType, string? defaultValue = null)
        {
            if (cols.Contains(name)) return;
            using var alterCmd = conn.CreateCommand();
            alterCmd.CommandText = defaultValue == null
                ? $"ALTER TABLE Posts ADD COLUMN {name} {sqlType}"
                : $"ALTER TABLE Posts ADD COLUMN {name} {sqlType} DEFAULT {defaultValue}";
            alterCmd.ExecuteNonQuery();
        }

        AddColumnIfMissing("Title", "TEXT", "''");
        AddColumnIfMissing("Category", "TEXT", "''");
        AddColumnIfMissing("Subcategory", "TEXT");
    }

    using (var backfillCmd = conn.CreateCommand())
    {
        backfillCmd.CommandText = "UPDATE Posts SET Title = Text WHERE (Title IS NULL OR Title = '') AND (Text IS NOT NULL AND Text <> '');";
        backfillCmd.ExecuteNonQuery();
    }
}

app.Run();
