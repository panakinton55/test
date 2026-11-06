import { z } from 'zod';

export const DESTINATIONS = ['llm.completions', 'search.query', 'tools.invoke'] as [
  'llm.completions',
  'search.query',
  'tools.invoke',
];
export type Destination = (typeof DESTINATIONS)[number];

export const SCOPE_FOR: Record<Destination, string> = {
  'llm.completions': 'llm.invoke',
  'search.query': 'search.read',
  'tools.invoke': 'tools.invoke',
};

const parameterKey = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);
const parameterValue = z.union([z.string().max(2000), z.number().finite(), z.boolean()]);

export const dispatchSchema = z
  .object({
    requestId: z.string().uuid(),
    destination: z.enum(DESTINATIONS),
    prompt: z.string().min(1).max(4000).refine((value) => value.trim().length > 0, 'blank_prompt'),
    parameters: z
      .record(parameterKey, parameterValue)
      .refine((value) => Object.keys(value).length <= 32, 'too_many_parameters'),
    metadata: z
      .object({
        traceId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
        agentVersion: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type DispatchBody = z.infer<typeof dispatchSchema>;
