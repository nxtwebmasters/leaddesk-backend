import { Request, Response } from 'express';
import { prisma } from '../../../common/prisma';
import { env } from '../../../config/env';
import { sendSuccess, sendError } from '../../../common/response';
import { SamlService } from './saml.service';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export class SsoController {
  /**
   * Look up if an email domain has SAML SSO configured & enforced
   */
  public static async lookup(req: Request, res: Response) {
    const email = (req.query.email as string)?.trim().toLowerCase();
    const domainQuery = (req.query.domain as string)?.trim().toLowerCase();

    const domain = domainQuery || (email && email.includes('@') ? email.split('@')[1] : null);

    if (!domain) {
      return sendError(res, 'VALIDATION_ERROR', 'Please provide an email or domain to check SSO status', 400);
    }

    // Check organizations matching domain or allowedDomains
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { domain: domain },
          { allowedDomains: { has: domain } },
        ],
        ssoEnabled: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        ssoEnabled: true,
        ssoProvider: true,
        enforceSso: true,
        logoUrl: true,
      },
    });

    if (!org) {
      return sendSuccess(res, {
        ssoAvailable: false,
        enforceSso: false,
      });
    }

    return sendSuccess(res, {
      ssoAvailable: true,
      enforceSso: org.enforceSso,
      provider: org.ssoProvider || 'GENERIC_SAML',
      orgId: org.id,
      orgName: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
    });
  }

  /**
   * Initiate SAML AuthN Request redirect
   */
  public static async initiate(req: Request, res: Response) {
    const orgId = (req.query.orgId as string) || (req.body.orgId as string);
    const slug = (req.query.slug as string) || (req.body.slug as string);
    const email = (req.query.email as string) || (req.body.email as string);

    let org = null;
    if (orgId) {
      org = await prisma.organization.findUnique({ where: { id: orgId } });
    } else if (slug) {
      org = await prisma.organization.findUnique({ where: { slug } });
    } else if (email && email.includes('@')) {
      const domain = email.split('@')[1].toLowerCase();
      org = await prisma.organization.findFirst({
        where: {
          OR: [{ domain }, { allowedDomains: { has: domain } }],
          ssoEnabled: true,
        },
      });
    }

    if (!org) {
      return sendError(res, 'NOT_FOUND', 'Organization not found or SSO not configured', 404);
    }

    if (!org.ssoEnabled) {
      return sendError(res, 'SSO_DISABLED', 'Enterprise SSO is not enabled for this organization', 403);
    }

    const hostUrl = `${req.protocol}://${req.get('host')}`;
    const relayState = JSON.stringify({ orgId: org.id, email: email || '' });

    const result = SamlService.generateAuthnRequest(org, hostUrl, relayState);

    // If API requested JSON
    if (req.headers.accept?.includes('application/json')) {
      return sendSuccess(res, result);
    }

    // Browser navigation
    return res.redirect(result.redirectUrl);
  }

  /**
   * Handle SAML 2.0 Assertion POST callback from IdP
   */
  public static async callback(req: Request, res: Response) {
    const samlResponse = req.body?.SAMLResponse;
    const relayState = req.body?.RelayState;

    if (!samlResponse) {
      return sendError(res, 'BAD_REQUEST', 'Missing SAMLResponse payload from Identity Provider', 400);
    }

    let orgId: string | null = null;
    if (relayState) {
      try {
        const parsed = JSON.parse(relayState);
        orgId = parsed.orgId;
      } catch {
        orgId = relayState;
      }
    }

    if (!orgId) {
      // Try to find default org
      const defaultOrg = await prisma.organization.findFirst({
        where: { ssoEnabled: true },
      });
      orgId = defaultOrg?.id || null;
    }

    if (!orgId) {
      return sendError(res, 'BAD_REQUEST', 'Unable to determine target organization for SAML assertion', 400);
    }

    try {
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org || !org.ssoEnabled) {
        return sendError(res, 'SSO_DISABLED', 'SSO is not enabled for this organization', 403);
      }

      const identity = SamlService.parseSamlResponse(samlResponse, org.ssoEntityId);
      const authResult = await SamlService.processSsoIdentity(identity, org.id);

      res.cookie('refreshToken', authResult.refreshToken, COOKIE_OPTIONS);

      // Redirect to frontend callback route with token
      const frontendUrl = env.CORS_ORIGIN || 'http://localhost:4200';
      const redirectTarget = `${frontendUrl}/login/sso-callback?token=${encodeURIComponent(
        authResult.accessToken
      )}&orgId=${encodeURIComponent(org.id)}`;

      return res.redirect(redirectTarget);
    } catch (err: any) {
      console.error('[SSO Callback Error]', err);
      const frontendUrl = env.CORS_ORIGIN || 'http://localhost:4200';
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(err.message || 'SSO Authentication failed')}`
      );
    }
  }

  /**
   * Return Service Provider XML Metadata for customer IdP setup
   */
  public static async getSpMetadata(req: Request, res: Response) {
    const { orgId } = req.params;
    const hostUrl = `${req.protocol}://${req.get('host')}`;

    const metadataXml = SamlService.generateSpMetadata(orgId, hostUrl);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `inline; filename="leaddesk-sp-metadata-${orgId}.xml"`);
    return res.status(200).send(metadataXml);
  }

  /**
   * Enterprise SSO Sandbox Simulator (Test connection without live IdP)
   */
  public static async testSimulator(req: Request, res: Response) {
    const orgId = req.query.orgId as string;
    const relayState = req.query.relayState as string;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return sendError(res, 'NOT_FOUND', 'Organization not found', 404);
    }

    // HTML test simulator allowing admin/developer to test SAML assertion exchange
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>LeadDesk SSO Sandbox Simulator</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; width: 440px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { margin-top: 0; color: #38bdf8; font-size: 1.25rem; }
    label { display: block; margin: 0.75rem 0 0.25rem; font-size: 0.85rem; color: #94a3b8; }
    input { width: 100%; box-sizing: border-box; padding: 0.6rem 0.75rem; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #fff; }
    button { margin-top: 1.25rem; width: 100%; padding: 0.75rem; border-radius: 6px; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; transition: 0.2s; }
    button:hover { background: #1d4ed8; }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; background: #0369a1; border-radius: 4px; font-size: 0.75rem; color: #e0f2fe; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">SAML 2.0 Mock IdP Sandbox</div>
    <h2>Simulate Single Sign-On</h2>
    <p style="font-size: 0.875rem; color: #cbd5e1; margin-bottom: 1rem;">
      Simulate an identity assertion response from <strong>${org.name}</strong> identity provider.
    </p>
    <form method="POST" action="/api/v1/auth/sso/callback" id="simForm">
      <label>Email Address</label>
      <input type="email" id="emailInput" value="sso.engineer@${org.domain || 'company.com'}" required />
      
      <label>Full Name</label>
      <input type="text" id="nameInput" value="Enterprise Pilot User" required />

      <input type="hidden" name="SAMLResponse" id="samlResponseField" />
      <input type="hidden" name="RelayState" value="${relayState || JSON.stringify({ orgId: org.id })}" />

      <button type="submit">Sign In via Simulated SAML &rarr;</button>
    </form>
  </div>

  <script>
    document.getElementById('simForm').addEventListener('submit', function(e) {
      const email = document.getElementById('emailInput').value;
      const name = document.getElementById('nameInput').value;
      const parts = name.split(' ');
      const first = parts[0] || 'Enterprise';
      const last = parts.slice(1).join(' ') || 'User';

      const xml = '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0">' +
        '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>' +
        '<saml:Assertion Version="2.0">' +
          '<saml:Issuer>http://mock-idp.leaddesk.internal</saml:Issuer>' +
          '<saml:Subject>' +
            '<saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">' + email + '</saml:NameID>' +
          '</saml:Subject>' +
          '<saml:AttributeStatement>' +
            '<saml:Attribute Name="email"><saml:AttributeValue>' + email + '</saml:AttributeValue></saml:Attribute>' +
            '<saml:Attribute Name="firstName"><saml:AttributeValue>' + first + '</saml:AttributeValue></saml:Attribute>' +
            '<saml:Attribute Name="lastName"><saml:AttributeValue>' + last + '</saml:AttributeValue></saml:Attribute>' +
            '<saml:Attribute Name="displayName"><saml:AttributeValue>' + name + '</saml:AttributeValue></saml:Attribute>' +
          '</saml:AttributeStatement>' +
        '</saml:Assertion>' +
      '</samlp:Response>';

      document.getElementById('samlResponseField').value = btoa(xml);
    });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }
}
