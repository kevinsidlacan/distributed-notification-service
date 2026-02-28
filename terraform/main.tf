terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1. Provide an SSH Key Pair so you can log into the server
resource "aws_key_pair" "deployer" {
  key_name   = "notif-deployer-key"
  public_key = file("~/.ssh/id_rsa.pub") # User must ensure they have an SSH key
}

# 2. Get the latest Amazon Linux 2023 AMI (which is free-tier eligible)
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

# 3. Create the actual EC2 Server
resource "aws_instance" "app_server" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type # t3.micro (Free Tier)
  key_name      = aws_key_pair.deployer.key_name

  vpc_security_group_ids = [aws_security_group.allow_web.id]

  # This script runs ONCE when the server boots
  user_data = <<-EOF
              #!/bin/bash
              # Update OS
              dnf update -y
              
              # Install git and Docker
              dnf install -y git docker
              systemctl enable docker
              systemctl start docker
              
              # Install Docker Compose V2 plugin
              mkdir -p /usr/local/lib/docker/cli-plugins/
              curl -SL "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose
              chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

              # Clone the repository
              cd /home/ec2-user
              git clone ${var.github_repo_url} app
              cd app

              # Create the secure .env file using Terraform variables
              cat <<EOT >> .env
              JWT_SECRET=${var.jwt_secret}
              ADMIN_EMAIL=${var.admin_email}
              ADMIN_PASSWORD=${var.admin_password}
              AWS_ACCESS_KEY_ID=${var.aws_ses_access_key}
              AWS_SECRET_ACCESS_KEY=${var.aws_ses_secret_key}
              FROM_EMAIL=${var.aws_ses_from_email}
              EOT

              # Ensure files are owned by ec2-user
              chown -R ec2-user:ec2-user /home/ec2-user/app

              # Start the stack!
              docker compose up -d
              EOF

  tags = {
    Name = "Notification-Service-Host"
  }
}

# 4. Attach a permanent Static IP Address (Elastic IP)
resource "aws_eip" "app_eip" {
  instance = aws_instance.app_server.id
  domain   = "vpc"
}
