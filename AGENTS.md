# AGENTS.md - Backend Architecture & AI Agent Guidelines

## 1. Project Overview
This repository contains the backend for a gamified auction system (focusing on item flipping, insta-sell, and virtual economy). 
The architecture follows a **Modular Monolith** approach built in **.NET (C#), Python, Angular, PostgreSQL**, transitioning towards event-driven microservices principles.

## 2. Global System Architecture (Based on Plan.png)
The broader ecosystem consists of the following components:
*   **UI/FRONTEND**: The client-facing application.
*   **API GATEWAY**: The single entry point for all client requests, routing them to the Backend API.
*   **BACKEND API**: The core Modular Monolith containing business logic.
*   **MESSAGE BROKER (RabbitMQ)**: Handles asynchronous communication and event distribution outside the monolith.
*   **AI BOTS**: Autonomous actors that interact with the system. They listen to RabbitMQ for market events and send commands via the API Gateway.

## 3. Backend Architecture (Modular Monolith)
The Backend API is divided into isolated modules.
*   **Auctions (Modules Actions)**: Handles bidding, listing, and market rules. Uses full CQRS (EF Core for writes, Dapper for complex reads).
*   **Wallets**: Manages virtual currency, locked funds, and double-spend protection. Uses CQS (EF Core for both writes and reads).
*   **Users (Identity)**: Manages authentication, JWT generation, and user registration.
*   **Shared.Integration**: The ONLY shared project. Contains integration events (e.g., `BidPlacedEvent`), custom exceptions (`AppException`), and shared contracts.

### Module Structural Rules (Strict)
1.  One module = One `.csproj` file.
2.  Internal structure must follow Clean Architecture folders: `Presentation`, `Application`, `Domain`, `Infrastructure`.
3.  **Domain & Application Isolation**: These layers MUST NOT reference ASP.NET Core (`Microsoft.AspNetCore.App`) directly. (Exception: The root `.csproj` references it, but developers must use the honor system to keep Domain pure).
4.  **No Cross-Module Database Joins**: Modules cannot query each other's database tables. They must communicate exclusively via Integration Events.

## 4. Key Architectural Patterns & Constraints
*   **Event-Driven Communication**: Modules react to events (via MediatR `INotificationHandler`).
*   **Optimistic Concurrency**: Financial transactions (Wallets) MUST use `Version` (Guid) tracking in EF Core to prevent Double-Spend anomalies (`DbUpdateConcurrencyException`).
*   **Outbox Pattern**: Domain events MUST be saved to the database in the same transaction as business state changes, to be published reliably later (e.g., by a Background Worker).
*   **Cancellation Tokens**: `CancellationToken` must be passed to read queries, but strictly ignored (`CancellationToken.None`) in critical financial writes (Commands) to prevent data corruption on network drops.
*   **Global Exception Handling**: All exceptions flow to a centralized `GlobalExceptionHandler` mapping domain exceptions and concurrency conflicts to HTTP status codes (e.g., 409 Conflict).

## 5. Testing Strategy
*   **Domain**: Fast, dependency-free Unit Tests using AAA (Arrange, Act, Assert).
*   **Infrastructure/Integration**: Real database tests using **Testcontainers** (Dockerized PostgreSQL) focusing on Handlers, DbContext, and Concurrency collisions. No database mocking.

