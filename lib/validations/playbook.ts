import { z } from 'zod'

export const CreateSetupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

export const UpdateSetupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  pdfUrl: z.string().url().optional(),
  pdfCloudinaryId: z.string().optional(),
})

export const CreateTriggerRuleSchema = z.object({
  precedence: z.number().int().positive(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  direction: z.enum(['LONG', 'SHORT', 'BOTH']).default('BOTH'),
})

export const UpdateTriggerRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  direction: z.enum(['LONG', 'SHORT', 'BOTH']).optional(),
  isActive: z.boolean().optional(),
  precedence: z.number().int().positive().optional(),
})

export const CreateSubSetupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

export const SetupPdfSchema = z.object({
  cloudinaryId: z.string().min(1),
  url: z.string().url(),
})

export type CreateSetupInput = z.infer<typeof CreateSetupSchema>
export type UpdateSetupInput = z.infer<typeof UpdateSetupSchema>
export type CreateTriggerRuleInput = z.infer<typeof CreateTriggerRuleSchema>
export type UpdateTriggerRuleInput = z.infer<typeof UpdateTriggerRuleSchema>
