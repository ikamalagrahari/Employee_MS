# Employee_MS

Employee management system with a Spring Boot backend and a React (Vite) frontend.

## Tech Stack

- Backend: Java 17, Spring Boot, Spring Web MVC, Spring Data JPA, Bean Validation
- Database: SQLite (`employee.db`)
- Frontend: React + Vite

## Project Structure

- `src/main/java/...` - Spring Boot backend (API, service, repository, entity, config)
- `src/main/resources/application.properties` - backend configuration
- `frontend/` - React application

## Prerequisites

- Java 17+
- Node.js 18+ and npm

## Run Backend

From repository root:

```bash
./mvnw spring-boot:run
```

Backend runs on `http://localhost:8080`.

## Run Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API Endpoints

Base URL: `http://localhost:8080/employees`

- `GET /employees` - list employees
- `GET /employees/{id}` - get employee by id
- `POST /employees` - create employee
- `PUT /employees/{id}` - update employee
- `DELETE /employees/{id}` - delete employee

## Employee Fields

- `id` (Long, auto-generated)
- `name` (required)
- `email` (required, unique, valid email)
- `department` (required)
- `salary` (required, >= 0)
- `phone` (optional)
- `jobTitle` (optional)
- `joiningDate` (optional, ISO date)
- `status` (required enum: `ACTIVE`, `INACTIVE`, `ON_LEAVE`, `TERMINATED`)

## Notes

- CORS is configured for `http://localhost:5173`.
- SQLite DB file (`employee.db`) is created/updated automatically by JPA.
