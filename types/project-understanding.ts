export interface ModuleInfo {
  name: string;
  description: string;
}

export interface ProjectUnderstanding {
  purpose: string;
  mainModules: ModuleInfo[];
  architectureSummary: string;
  keyFeatures: string[];
  techStackDetails: string;
  dataFlow: string;
}