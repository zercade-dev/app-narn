import { Router, type Request, type Response, type Router as RouterType } from 'express';
import { z } from 'zod';
import { auditLogger } from '../services/audit-logger.js';
import { asyncHandler } from '../http/index.js';

const cspViolationSchema = z.object({
  'csp-report': z
    .object({
      'document-uri': z.string().optional(),
      'violated-directive': z.string().optional(),
      'effective-directive': z.string().optional(),
      'original-policy': z.string().optional(),
      'blocked-uri': z.string().optional(),
      'line-number': z.number().optional(),
      'column-number': z.number().optional(),
      'source-file': z.string().optional(),
      'status-code': z.number().optional(),
      'script-sample': z.string().optional(),
      'user-agent': z.string().optional(),
    })
    .optional(),
});

export const cspViolationRouter: RouterType = Router();

interface CspViolationRequest extends Request {
  body: unknown;
}

/**
 * POST /api/csp-violation
 *
 * Receives CSP violation reports from browsers.
 * Logs violations to audit logger for security monitoring.
 */
cspViolationRouter.post(
  '/',
  asyncHandler(async (req: CspViolationRequest, res: Response) => {
    // Real browser reports arrive as application/csp-report (report-uri) or
    // application/reports+json (Reporting API), so they are parsed as text by
    // express.text() and reach us as a JSON string (or an array, for the
    // Reporting API). Normalize to the csp-report envelope before validating.
    let body: unknown = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = undefined;
      }
    }
    if (Array.isArray(body)) {
      body = (body[0] as { body?: unknown })?.body ?? body[0];
    }

    const result = cspViolationSchema.safeParse(body);

    if (!result.success) {
      // Log malformed reports at debug level. Attacker-controlled raw input is
      // deliberately NOT logged — it would pollute the security audit trail.
      auditLogger.log('security.csp-violation', {
        error: 'Invalid CSP report format',
        validationErrors: JSON.stringify(result.error.flatten()),
      });
      res.status(400).json({ error: 'Invalid CSP report format' });
      return;
    }

    const report = result.data['csp-report'];

    if (!report) {
      auditLogger.log('security.csp-violation', {
        error: 'Missing csp-report object',
      });
      res.status(400).json({ error: 'Missing csp-report object' });
      return;
    }

    // Extract key violation details
    const violationDetails: Record<string, unknown> = {
      documentUri: report['document-uri'],
      violatedDirective: report['violated-directive'],
      effectiveDirective: report['effective-directive'],
      blockedUri: report['blocked-uri'],
      lineNumber: report['line-number'],
      columnNumber: report['column-number'],
      sourceFile: report['source-file'],
      statusCode: report['status-code'],
      userAgent: report['user-agent'],
    };

    // Log the violation
    auditLogger.log('security.csp-violation', violationDetails);

    // Return 204 No Content as expected by browsers
    res.status(204).end();
  }),
);
