# Claude Instructions

## Feature Development Guidelines

When the user requests a new feature, always follow these steps:

1. **Create Feature Documentation**: Before implementing any new feature, create a detailed specification file in `/Users/itaykarkason/Python Projects/budget_app_project_new/new_features/` with the following format:
   - Filename: `feature_[feature_name].md`
   - Include: Feature description, requirements, technical specifications, and implementation plan

2. **Implementation**: Only after creating the feature documentation, proceed with the actual implementation.

## Project Structure Notes

- New feature specifications should be stored in: `/Users/itaykarkason/Python Projects/budget_app_project_new/new_features/`
- This directory already contains existing feature files that can serve as examples

## Development Workflow

Always prioritize documentation before implementation to ensure clear requirements and planning.

## Project Documentation Maintenance

**IMPORTANT**: Whenever you add new features, routes, endpoints, or make significant changes to the application:

1. **Update PROJECT_DOCUMENTATION.md**: Always update the comprehensive project documentation file at `/Users/itaykarkason/Python Projects/budget_app_project_new/PROJECT_DOCUMENTATION.md` to reflect:
   - New API endpoints with full documentation
   - Updated frontend routes
   - New database schema changes
   - Additional external integrations
   - Security or authentication changes
   - New environment variables or configuration

2. **Documentation Standards**: When updating the documentation:
   - Include HTTP methods, parameters, and response formats for all endpoints
   - Explain what each endpoint does in English
   - Document any authentication requirements
   - Include query parameters and request/response examples
   - Update the API response formats if they change
   - Maintain the existing documentation structure and format

3. **Keep Documentation Current**: The PROJECT_DOCUMENTATION.md file serves as the single source of truth for the entire application. It must always be kept up-to-date with any changes to ensure it remains accurate and useful.