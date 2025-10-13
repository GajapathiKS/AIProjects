using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SpecialPrograms.Api.Data;
using SpecialPrograms.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<IStudentService, StudentService>();
builder.Services.AddScoped<INeedsAssessmentService, NeedsAssessmentService>();
builder.Services.AddScoped<IGoalService, GoalService>();
builder.Services.AddScoped<IProgressService, ProgressService>();
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.Configure<SeedUserOptions>(builder.Configuration.GetSection("SeedUser"));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseHttpsRedirection();
app.UseCors("Default");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Ensure database is up to date and create Assignments table if it's missing
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        // Apply existing EF Core migrations
        db.Database.Migrate();

        // Create Assignments table if it doesn't exist yet (for environments created before Assignments existed)
        db.Database.ExecuteSqlRaw(@"
IF OBJECT_ID(N'[dbo].[Assignments]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Assignments](
        [Id] uniqueidentifier NOT NULL,
        [StudentId] uniqueidentifier NOT NULL,
        [Title] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [DueDate] datetime2 NULL,
        [Status] nvarchar(max) NOT NULL DEFAULT N'Open',
        [AssignedTo] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Assignments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Assignments_Students_StudentId] FOREIGN KEY ([StudentId]) REFERENCES [dbo].[Students]([Id]) ON DELETE CASCADE
    );
    CREATE INDEX [IX_Assignments_StudentId] ON [dbo].[Assignments]([StudentId]);
END
");
    }
    catch
    {
        // Swallow startup DB init errors to avoid blocking the app; logs will capture details
    }
}

app.Run();
