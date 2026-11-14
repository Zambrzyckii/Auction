FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY AuctionServer.slnx .
COPY src/AuctionServer.Api/AuctionServer.Api.csproj src/AuctionServer.Api/
COPY src/AuctionServer.Modules.Auctions/AuctionServer.Modules.Auctions.csproj src/AuctionServer.Modules.Auctions/
COPY src/AuctionServer.Modules.Banking/AuctionServer.Modules.Banking.csproj src/AuctionServer.Modules.Banking/
COPY src/AuctionServer.Modules.Casino/AuctionServer.Modules.Casino.csproj src/AuctionServer.Modules.Casino/
COPY src/AuctionServer.Modules.Identity/AuctionServer.Modules.Identity.csproj src/AuctionServer.Modules.Identity/
COPY src/AuctionServer.Modules.Inventory/AuctionServer.Modules.Inventory.csproj src/AuctionServer.Modules.Inventory/
COPY src/AuctionServer.Modules.Pawnshop/AuctionServer.Modules.Pawnshop.csproj src/AuctionServer.Modules.Pawnshop/
COPY src/AuctionServer.Modules.Profiles/AuctionServer.Modules.Profiles.csproj src/AuctionServer.Modules.Profiles/
COPY src/AuctionServer.Modules.Wallets/AuctionServer.Modules.Wallets.csproj src/AuctionServer.Modules.Wallets/
COPY src/AuctionServer.Modules.Warehouses/AuctionServer.Modules.Warehouses.csproj src/AuctionServer.Modules.Warehouses/
COPY src/AuctionServer.Shared.Infrastructure/AuctionServer.Shared.Infrastructure.csproj src/AuctionServer.Shared.Infrastructure/
COPY src/AuctionServer.Shared.Integration/AuctionServer.Shared.Integration.csproj src/AuctionServer.Shared.Integration/
RUN dotnet restore src/AuctionServer.Api
COPY src/ src/
RUN dotnet publish src/AuctionServer.Api -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:11.0
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app .
USER app
ENTRYPOINT ["dotnet", "AuctionServer.Api.dll"]
