export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiGenerateParams = {
  systemInstruction: string;
  userPrompt: string;
  maxOutputTokens: number;
  temperature: number;
};

export type AiGenerateResult = {
  text: string;
  provider: string;
  model: string;
};

export interface AiProvider {
  readonly name: string;
  generate(params: AiGenerateParams): Promise<AiGenerateResult>;
}
