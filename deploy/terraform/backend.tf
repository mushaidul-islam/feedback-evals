terraform {
  required_version = ">= 1.14.0, < 2.0.0"

  backend "s3" {
    bucket       = "tf-state-relearnify"
    key          = "feedback-evals/production.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true
  }
}
