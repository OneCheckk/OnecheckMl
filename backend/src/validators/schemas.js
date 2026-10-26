const { z } = require('zod');

// 1. Auth Schemas
const authLoginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

// 2. Application Schemas
const applicationCreateSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  academicYear: z.string().optional(),
  institutionId: z.string().optional()
});

const applicationPatchSchema = z.object({
  category: z.string().optional(),
  academicYear: z.string().optional()
});

// 3. Claim Schemas
const claimPatchSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()], {
    required_error: 'Corrected value is required'
  }),
  reason: z.string().min(5, 'Correction reason must be at least 5 characters')
});

// 4. Finding Disposition Schema
const findingDispositionSchema = z.object({
  state: z.enum(['OPEN', 'ACCEPTED', 'DISMISSED', 'CLARIFICATION_REQUESTED', 'RESOLVED'], {
    required_error: 'Disposition state is required'
  }),
  reason: z.string().optional()
}).refine(
  (data) => {
    if (data.state === 'DISMISSED') {
      return typeof data.reason === 'string' && data.reason.trim().length >= 10;
    }
    return true;
  },
  {
    message: 'A mandatory reason of at least 10 characters is required when dismissing a finding.',
    path: ['reason']
  }
);

// 5. Decision Schema
const applicationDecisionSchema = z.object({
  outcome: z.enum(
    ['ACCEPT_SCRUTINY', 'REQUEST_CLARIFICATION', 'REFER_FOR_INSPECTION', 'RECOMMEND_ADVERSE_ACTION'],
    { required_error: 'Decision outcome is required' }
  ),
  reason: z.string().min(5, 'Decision reason is required')
});

// 6. Manual Ledger Confirmation Schema
const manualConfirmSchema = z.object({
  outcome: z.enum(['CONFIRMED', 'REJECTED'], {
    required_error: 'Outcome must be CONFIRMED or REJECTED'
  }),
  note: z.string().optional()
});

// 7. Deficiency Letter Schemas
const letterDraftSchema = z.object({
  findingIds: z.array(z.string()).default([]),
  body: z.string().min(1, 'Letter body content is required')
});

// 8. Demo Settings Schema
const demoSettingsSchema = z.object({
  clockOffsetDays: z.number().int().default(0),
  forceSourceUnavailable: z.boolean().default(false)
});

// 9. Admin Rulepack Schema
const rulepackRegisterSchema = z.object({
  version: z.string().min(1, 'Rulepack version is required'),
  yamlText: z.string().min(1, 'Rulepack YAML text is required'),
  notes: z.string().optional()
});

// 10. Admin Checklist Schema
const checklistUpdateSchema = z.object({
  version: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      docTypes: z.array(z.string()),
      required: z.boolean().default(true),
      clauseRef: z.string().default('HANDBOOK-REF-TBD'),
      placeholder: z.boolean().default(false)
    })
  )
});

// 11. Admin User Management Schema
const adminCreateUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['INSTITUTION', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN', 'AUDITOR', 'OFFICER', 'INSTITUTION_USER']),
  institutionId: z.string().optional()
});

const adminPatchUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['INSTITUTION', 'SCRUTINY_OFFICER', 'REGIONAL_DIRECTOR', 'ADMIN', 'AUDITOR', 'OFFICER', 'INSTITUTION_USER']).optional(),
  active: z.boolean().optional(),
  institutionId: z.string().optional()
});

module.exports = {
  authLoginSchema,
  applicationCreateSchema,
  applicationPatchSchema,
  claimPatchSchema,
  findingDispositionSchema,
  applicationDecisionSchema,
  manualConfirmSchema,
  letterDraftSchema,
  demoSettingsSchema,
  rulepackRegisterSchema,
  checklistUpdateSchema,
  adminCreateUserSchema,
  adminPatchUserSchema
};
