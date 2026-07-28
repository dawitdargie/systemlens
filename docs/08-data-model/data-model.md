# Core Domain Models
Six domain models.

* Repository
* Technical Facts
* Project Understanding
* Project Profile
* Explanation
* Chat Message

Nothing more.

## Domain Model Diagram

                ┌────────────────────┐
                │     Repository     │
                └─────────┬──────────┘
                          │
                          │
                ┌─────────▼──────────┐
                │  Technical Facts   │
                └─────────┬──────────┘
                          │
                          │
                ┌─────────▼──────────┐
                │Project Understanding│
                └─────────┬──────────┘
                          │
           ┌──────────────▼──────────────┐
           │       Project Profile       │
           └───────────┬─────────────────┘
                       │
      ┌────────────────┴───────────────┐
      │                                │
      ▼                                ▼
┌──────────────────┐             ┌──────────────────┐
│   Explanation    │             │   Chat Message   │
└──────────────────┘             └──────────────────┘


## 1. Repository

Represents the analysed GitHub repository.

### Attributes

Repository
name
owner
url
defaultBranch


### Source

GitHub API

## 2. Technical Facts

Represents deterministic facts extracted by the Light Analyzer.

### Attributes

TechnicalFacts
language
framework
deployment


### Examples

* **Language** → Go
* **Framework** → Gin
* **Deployment** → Docker

### Source

Light Analyzer  
No AI involved.

## 3. Project Understanding

Represents the AI's interpretation of the repository.

### Attributes

ProjectUnderstanding
purpose
mainModules
architectureSummary


### Examples

#### Purpose

Online food delivery platform

#### Main Modules

* Authentication
* Orders
* Payments

#### Architecture

Layered architecture using handlers,  
services and repositories.

### Source

Gemini

## 4. Project Profile

The central model of the entire application.  
Everything revolves around this object.

### Attributes

ProjectProfile
repository
technicalFacts
understanding


### Built by

Profile Builder  
Not by Gemini.  
This matches the architecture we designed in Stage 6.

## 5. Explanation

Represents an audience-specific explanation.

### Attributes

Explanation
audience
content
diagram


### Audience values

* CEO
* PM
* Developer
* QA
* Customer

### Diagram

Mermaid syntax.

### Source

AI Service

## 6. Chat Message

Represents one message in the conversation.

### Attributes

ChatMessage
role
content


### Role

* user
* assistant

### Purpose

Maintains conversation context during the current browser session.  
No persistence is required for the MVP.

## Relationships

### Repository

Produces

Repository
│
▼
Project Profile


### Technical Facts

Contribute to

Technical Facts
│
▼
Project Profile


### Project Understanding

Contributes to

Project Understanding
│
▼
Project Profile


### Project Profile

Used by

Project Profile
│
├────────► Explanation
│
└────────► Chat


This is why we designed `/api/explain` and `/api/chat` to receive a Project Profile.

## Data Flow

Repository
│
▼
Technical Facts
│
▼
Project Understanding
│
▼
Project Profile
│
├────────► Explanation
│
└────────► Chat


## Model Ownership

| Model | Owner |
| --- | --- |
| Repository | GitHub API |
| Technical Facts | Light Analyzer |
| Project Understanding | AI Service (Gemini) |
| Project Profile | Profile Builder |
| Explanation | AI Service |
| Chat Message | Frontend |