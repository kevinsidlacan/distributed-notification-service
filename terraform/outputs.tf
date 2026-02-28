output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.app_server.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.app_eip.public_ip
}

output "app_url" {
  description = "The URL to access your deployed application"
  value       = "http://${aws_eip.app_eip.public_ip}"
}
