variable "aws_region" {
  description = "The AWS region to deploy to"
  type        = string
  default     = "ap-southeast-1"
}

variable "instance_type" {
  description = "The EC2 instance type (t3.micro is Free Tier)"
  type        = string
  default     = "t3.micro"
}

variable "github_repo_url" {
  description = "The public GitHub HTTPS URL of your repository"
  type        = string
  # Example: "https://github.com/kevinsidlacan/distributed-notification-service.git"
}

# --- Secrets (These will be provided via terraform.tfvars locally, NOT in git) ---

variable "jwt_secret" {
  description = "The secret used to sign JWT tokens"
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "The default admin email to seed"
  type        = string
}

variable "admin_password" {
  description = "The default admin password to seed"
  type        = string
  sensitive   = true
}

variable "aws_ses_access_key" {
  description = "AWS IAM Access Key for SES"
  type        = string
  sensitive   = true
  default     = "" # Optional until SES is out of sandbox
}

variable "aws_ses_secret_key" {
  description = "AWS IAM Secret Key for SES"
  type        = string
  sensitive   = true
  default     = ""
}

variable "aws_ses_from_email" {
  description = "The verified email address SES sends from"
  type        = string
  default     = ""
}
