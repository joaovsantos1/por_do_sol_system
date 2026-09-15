using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Pdv.Api.Hubs;
using Pdv.Application.Auth;
using Pdv.Application.Comandas;
using Pdv.Infrastructure.Data;
using Pdv.Infrastructure.Services;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

var porta = Environment.GetEnvironmentVariable("PORT") ?? "8080";
builder.WebHost.UseUrls($"http://0.0.0.0:{porta}");

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();
builder.Host.UseSerilog();

// ---- Banco de dados ----
builder.Services.AddDbContext<PdvDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// ---- Serviços de domínio/aplicação ----
builder.Services.AddScoped<StockService>();
builder.Services.AddScoped<IStockService>(sp => sp.GetRequiredService<StockService>());
builder.Services.AddScoped<ComandaService>();
builder.Services.AddScoped<FechamentoService>();
builder.Services.AddScoped<Pdv.Application.Vendas.VendaService>();
builder.Services.AddScoped<AuthService>();
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

// ---- Autenticação JWT ----
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtSecret = jwtSection["Secret"]!;
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSection["Issuer"],
        ValidAudience = jwtSection["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };

    // Permite que o SignalR receba o token via query string (necessário
    // porque o cliente de WebSocket não envia cabeçalhos customizados).
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization();

// ---- Autorização baseada em perfil é aplicada nos controllers via
// [Authorize(Roles = "...")]. O frontend também restringe a navegação,
// mas a validação real e definitiva ocorre aqui no backend. ----

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "PDV Sistema API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new()
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Informe: Bearer {seu token}"
    });
    c.AddSecurityRequirement(new()
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var origensPermitidas = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:4200")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        policy.WithOrigins(origensPermitidas)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ComandasHub>("/hubs/comandas");
app.MapHub<EstoqueHub>("/hubs/estoque");

// ---- Seed inicial (usuário administrador, categorias e produtos de exemplo) ----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PdvDbContext>();
    await db.Database.MigrateAsync();
    await Pdv.Api.Seed.DatabaseSeeder.SeedAsync(db, app.Configuration);
}

app.Run();
