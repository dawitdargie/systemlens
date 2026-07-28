# Requirements

## Overview

This document defines the functional and non-functional requirements for SystemLens.

---

# Functional Requirements

## Repository Analysis

### FR-01
The user can submit a public GitHub repository URL.

### FR-02
The system retrieves repository information using the GitHub API.

### FR-03
The system identifies important files required for analysis.

### FR-04
The system extracts technical facts and generates a reusable project profile.

---

## Project Explanation

### FR-05
The user can choose an explanation audience.

Supported audiences:

- CEO
- PM
- Developer
- QA
- Customer

### FR-06
The system generates an explanation tailored to the selected audience.

---

## Visualization

### FR-07
The system generates simple visual representations of the project.

Examples:

- Architecture overview
- Module relationships

---

## Project Chat

### FR-08
The user can ask questions about the analyzed project.

### FR-09
The system answers questions using project context.

### FR-10
The system can retrieve relevant source files for code-related questions.

### FR-11
The system explains specific parts of the codebase using retrieved source context.

---

# Non-Functional Requirements

## Performance

### NFR-01
Repository analysis should complete within an acceptable time.

### NFR-02
The system should provide progress feedback during analysis.

---

## Reliability

### NFR-03
The system should handle:

- Invalid GitHub URLs
- Missing files
- Unsupported repositories
- AI failures

---

## Security

### NFR-04
API keys and secrets must never be exposed to the client.

---

## Cost

### NFR-05
The MVP must operate entirely using free-tier services.

---

## Maintainability

### NFR-06
The codebase should be modular and easy to extend with new personas, analyzers, and AI capabilities.

---

# User Stories

## US-01

As a CEO,  
I want a high-level explanation of the software system,  
so that I can understand its purpose and business value without reading code.

---

## US-02

As a PM,  
I want a business-focused explanation,  
so that I can understand the software features and capabilities.

---

## US-03

As a Developer,  
I want to understand an unfamiliar repository and its code,  
so that I can become productive quickly.

---

## US-04

As a QA,  
I want to understand the important parts of the system,  
so that I know what areas require testing.

---

## US-05

As a user,  
I want to ask questions about the project and code,  
so that I can explore unfamiliar systems faster.

---

# MVP Scope

- Analyze public GitHub repositories
- Extract project information
- Build project profiles
- Generate audience-specific explanations
- Generate Mermaid diagrams
- Provide AI-powered project chat
- Answer code-related questions using relevant source files