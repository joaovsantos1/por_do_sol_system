FROM mcr.microsoft.com/dotnet/sdk:8.0 AS base
WORKDIR /src

# Ferramenta de migrations do EF Core (usada no docker-compose para aplicar
# as migrations automaticamente ao subir o container em desenvolvimento).
RUN dotnet tool install --global dotnet-ef --version 8.*
ENV PATH="${PATH}:/root/.dotnet/tools"

COPY . .
RUN dotnet restore src/Api/Api.csproj

EXPOSE 8080
CMD ["dotnet", "run", "--project", "src/Api", "--urls", "http://0.0.0.0:8080"]
