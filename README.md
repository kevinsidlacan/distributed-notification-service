# Distributed Notification Service

A robust, full-stack application designed to demonstrate Senior-level architectural patterns, including background job processing, queueing, and secure API design.

## Architecture
- **Frontend:** React (Vite) + Nginx SPA Routing
- **Backend:** Node.js (Express) + TypeScript
- **Database:** PostgreSQL (Prisma ORM)
- **Queue/Cache:** Redis + BullMQ
- **Email:** Strategy Pattern (Mock Email Provider + AWS SES)

## Running Locally (Docker Compose)
This project enforces **strict environment variables** in its `docker-compose.yml` to guarantee security before booting. 

To run the full stack locally:

1. Create a `.env` file in the root directory.
2. Ensure you define all required configurations (refer to `.env.example`). *Crucially, you must provide values for `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`*.
3. Run the stack:
```bash
docker compose up -d
```

The stack will start on port `80` using a multi-stage Nginx container.

## AWS / Terraform Deployment
This repository is configured for a "Single-Node EC2 Docker Host" deployment using the Free Tier.
1. Copy `terraform.tfvars.example` to `terraform.tfvars`.
2. Populate production secrets.
3. Run `terraform apply` to provision the EC2 server, configure the Security Group, and securely inject `.tfvars` into the instance environment logic before booting `docker compose`.
