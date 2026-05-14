import { IsIn, IsOptional, IsString } from 'class-validator';
import { INFOGRAPHIC_PROMPT_TEMPLATE_KEYS } from '../templates/infographic-prompt-templates';

export class PrepareInfographicPromptDto {
  @IsString()
  @IsIn(INFOGRAPHIC_PROMPT_TEMPLATE_KEYS)
  templateKey: string;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  csvText?: string;

  @IsString()
  @IsOptional()
  screenshotInsights?: string;

  @IsString()
  @IsOptional()
  additionalContext?: string;

  // When the editor inline-edits rows in the review step, the FE ships the
  // rebuilt summary here. We skip research and use this verbatim so the
  // image model sees exactly the data the editor just approved.
  @IsString()
  @IsOptional()
  overrideDataSummary?: string;
}
