import { z } from 'zod'

export const FactorOpSchema = z.enum(['MULTIPLY', 'DIVIDE'])

export const CreateInstrumentSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20),
  name: z.string().min(1, 'Name is required').max(80),
  // The factor must be strictly positive — 0 / negative would corrupt every
  // currency value it touches. Blocked here and in the UI.
  factor: z.number({ message: 'Factor must be a number' }).positive('Factor must be > 0'),
  factorOp: FactorOpSchema.default('MULTIPLY'),
})

export const UpdateInstrumentSchema = CreateInstrumentSchema.partial()

export type CreateInstrumentInput = z.infer<typeof CreateInstrumentSchema>
export type UpdateInstrumentInput = z.infer<typeof UpdateInstrumentSchema>
