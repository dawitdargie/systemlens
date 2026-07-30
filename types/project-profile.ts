import { Repository } from "./repository";
import { TechnicalFacts } from "./technical-facts";
import { ProjectUnderstanding } from "./project-understanding";

export interface ProjectProfile {
  repository: Repository;
  technicalFacts: TechnicalFacts;
  understanding: ProjectUnderstanding;
}