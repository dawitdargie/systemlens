export type Audience = "CEO" | "PM" | "Developer" | "QA" | "Customer";

export interface Explanation {
  audience: Audience;
  content: string;
  diagram: string;
}