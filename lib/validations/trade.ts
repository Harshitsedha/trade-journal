import { z } from 'zod'

export const AssetClassSchema = z.enum(['FUTURES', 'OPTIONS', 'EQUITY'])
export const DirectionSchema = z.enum(['LONG', 'SHORT'])
export const TradeStatusSchema = z.enum(['OPEN', 'CLOSED', 'SCRATCHED', 'MISSED'])
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

// Shared base object (ZodObject so .extend() works on it)
const tradeBaseObject = z.object({
  instrument: z.string().min(1, 'Instrument is required').max(20),
  assetClass: AssetClassSchema,
  expiry: z.string().datetime().optional().nullable(),
  setupId: z.string().cuid('Invalid setup ID'),
  subSetupId: z.string().cuid('Invalid sub-setup ID').optional().nullable(),
  // Optional for MISSED trades (enforced below via superRefine for others)
  direction: DirectionSchema.optional(),
  entryPrice: decimalString.optional(),
  stopLoss: decimalString.optional(),
  targets: z.array(decimalString).optional(),
  quantity: decimalString.optional(),
  riskAmount: decimalString.optional(),
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
  status: TradeStatusSchema.optional(),
  // Ideal exit — captured at exit time only
  idealExit: decimalString.optional().nullable(),
})

type TradeBase = z.infer<typeof tradeBaseObject>

function requireNonMissedFields(data: TradeBase, ctx: z.RefinementCtx) {
  if (data.status === 'MISSED') return
  if (!data.direction) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['direction'], message: 'Required' })
  if (!data.entryPrice) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['entryPrice'], message: 'Required' })
  if (!data.stopLoss) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stopLoss'], message: 'Required' })
  if (!data.targets?.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targets'], message: 'At least one target required' })
  if (!data.quantity) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Required' })
  if (!data.riskAmount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['riskAmount'], message: 'Required' })
}

export const CreateTradeSchema = tradeBaseObject.superRefine(requireNonMissedFields)

const tradeUpdateObject = tradeBaseObject.extend({
  exitPrice: decimalString.optional(),
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

export const UpdateTradeSchema = tradeUpdateObject.superRefine(requireNonMissedFields)

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
