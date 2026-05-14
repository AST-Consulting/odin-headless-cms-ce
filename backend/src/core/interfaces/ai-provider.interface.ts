export interface AIProviderInterface {
  getLLM(): any; // Replace 'any' with the actual type if known
  getConfig(): AIProviderConfig;
}

export interface AIProviderConfig {
  llm: any; // Replace 'any' with the actual type if known
  temperature: number;
}
