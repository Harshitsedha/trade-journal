import { z } from 'zod'

export const AssetClassSchema = z.enum(['FUTURES', 'OPTIONS', 'EQUITY'])
export const DirectionSchema = z.enum(['LONG', 'SHORT'])
export const TradeStatusSchema = z.enum(['OPEN', 'CLOSED', 'SCRATCHED'])
export const RuleBreakTypeSchema = z.enum([
  'EARLY_EXIT',
  'LATE_EXIT',
  'MOVED_STOP',
  'OVERSIZED',
  'REVENGE_TRADE',
  'OTHER',
])

const decimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a valid number')

export const CreateTradeSchema = z.object({
  instrument: z.string().min(1, 'Instrument is required').max(20),
  assetClass: AssetClassSchema,
  expiry: z.string().datetime().optional().nullable(),
  setupId: z.string().cuid('Invalid setup ID'),
  subSetupId: z.string().cuid('Invalid sub-setup ID').optional().nullable(),
  direction: DirectionSchema,
  entryPrice: decimalString,
  stopLoss: decimalString,
  targets: z.array(decimalString).min(1, 'At least one target required'),
  quantity: decimalString,
  riskAmount: decimalString,
  thesis: z.string().max(2000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tradeDate: z.string().datetime(),
  triggerRules: z
    .array(
      z.object({
        triggerRuleId: z.string().cuid(),
        isPrimary: z.boolean(),
      })
    )
    .optional(),
})

export const UpdateTradeSchema = z.object({
  exitPrice: decimalString.optional(),
  status: TradeStatusSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
  thesis: z.string().max(2000).optional().nullable(),
  ruleBreak: z
    .object({
      breakType: RuleBreakTypeSchema,
      ruleDescription: z.string().min(1).max(500),
      actualExitPrice: decimalString,
      ruleExitPrice: decimalString.optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
    })
    .optional(),
})

export const TradeFilterSchema = z.object({
  status: TradeStatusSchema.optional(),
  setupId: z.string().optional(),
  assetClass: AssetClassSchema.optional(),
  direction: DirectionSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const CreateSetupSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional().nullable(),
})

export const CreateSubSetupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
})

export type CreateTradeInput = z.infer<typeof CreateTradeSchema>
export type UpdateTradeInput = z.infer<typeof UpdateTradeSchema>
export type TradeFilterInput = z.infer<typeof TradeFilterSchema>
export type CreateSetupInput = z.infer<typeof CreateSetupSchema>
export type CreateSubSetupInput = z.infer<typeof CreateSubSetupSchema>
