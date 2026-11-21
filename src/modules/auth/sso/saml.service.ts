import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../common/prisma';
import { TokenService } from '../token.service';
import { SamlIdentity, SsoInitiateResult } from './sso.types';

export class SamlService {
  /**
   * Generates SAML 2.0 AuthN Request XML and destination URL
   */
  public static generateAuthnRequest(
    org: { id: string; slug: string; ssoLoginUrl?: string | null; ssoEntityId?: string | null },
    hostUrl: string,
    relayState?: string
  ): SsoInitiateResult {
    const requestId = '_' + crypto.randomBytes(16).toString('hex');
    const issueInstant = new Date().toISOString();
    const spEntityId = `${hostUrl}/api/v1/auth/sso/metadata/${org.id}`;
    const acsUrl = `${hostUrl}/api/v1/auth/sso/callback`;

    // Standard SAML 2.0 AuthnRequest
    const authnXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${org.ssoLoginUrl || ''}"
  AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`.trim();

    const base64Request = Buffer.from(authnXml).toString('base64');
    const safeRelayState = relayState || JSON.stringify({ orgId: org.id });

    if (!org.ssoLoginUrl) {
      // Sandbox / Mock simulation mode
      return {
        redirectUrl: `${hostUrl}/api/v1/auth/sso/test-simulator?orgId=${org.id}&relayState=${encodeURIComponent(safeRelayState)}`,
        samlRequest: base64Request,
        relayState: safeRelayState,
        isMock: true,
      };
    }

    const separator = org.ssoLoginUrl.includes('?') ? '&' : '?';
    const redirectUrl = `${org.ssoLoginUrl}${separator}SAMLRequest=${encodeURIComponent(base64Request)}&RelayState=${encodeURIComponent(safeRelayState)}`;

    return {
      redirectUrl,
      samlRequest: base64Request,
      relayState: safeRelayState,
      isMock: false,
    };
  }

  /**
   * Generates standard SAML 2.0 Service Provider Metadata XML
   */
  public static generateSpMetadata(orgId: string, hostUrl: string): string {
    const entityId = `${hostUrl}/api/v1/auth/sso/metadata/${orgId}`;
    const acsUrl = `${hostUrl}/api/v1/auth/sso/callback`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`.trim();
  }

  /**
   * Parses standard SAML 2.0 Response XML (Base64 encoded)
   */
  public static parseSamlResponse(rawSamlResponse: string, expectedIssuer?: string | null): SamlIdentity {
    let xml: string;
    try {
      xml = Buffer.from(rawSamlResponse, 'base64').toString('utf8');
    } catch {
      throw new Error('Invalid base64 encoding on SAML response');
    }

    // Check StatusCode
    if (!xml.includes('urn:oasis:names:tc:SAML:2.0:status:Success')) {
      const statusMatch = xml.match(/<samlp:StatusMessage>(.*?)<\/samlp:StatusMessage>/i);
      const msg = statusMatch ? statusMatch[1] : 'SAML authentication failed at Identity Provider';
      throw new Error(`SAML IdP Error: ${msg}`);
    }

    // Extract NameID
    const nameIdMatch = xml.match(/<(?:saml2?:)?NameID[^>]*>([^<]+)<\/(?:saml2?:)?NameID>/i);
    const nameId = nameIdMatch ? nameIdMatch[1].trim() : '';

    // Extract Issuer
    const issuerMatch = xml.match(/<(?:saml2?:)?Issuer[^>]*>([^<]+)<\/(?:saml2?:)?Issuer>/i);
    const issuer = issuerMatch ? issuerMatch[1].trim() : undefined;

    if (expectedIssuer && issuer && expectedIssuer.toLowerCase() !== issuer.toLowerCase()) {
      console.warn(`[SAML] Warning: Issuer mismatch. Expected: ${expectedIssuer}, received: ${issuer}`);
    }

    // Helper to find attribute values
    const getAttr = (names: string[]): string | undefined => {
      for (const name of names) {
        // Escaped regex for attribute name matching
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          `<(?:saml2?:)?Attribute[^>]*Name=["']${escaped}["'][^>]*>\\s*<(?:saml2?:)?AttributeValue[^>]*>([^<]+)<\\/(?:saml2?:)?AttributeValue>`,
          'i'
        );
        const match = xml.match(pattern);
        if (match && match[1]) return match[1].trim();
      }
      return undefined;
    };

    const email =
      getAttr([
        'email',
        'Email',
        'User.Email',
        'mail',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        'urn:oid:0.9.2342.19200300.100.1.3',
      ]) ||
      (nameId.includes('@') ? nameId : undefined);

    if (!email) {
      throw new Error('Could not extract email address from SAML response NameID or Attributes');
    }

    const firstName = getAttr([
      'firstName',
      'FirstName',
      'givenName',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    ]);
    const lastName = getAttr([
      'lastName',
      'LastName',
      'surname',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    ]);
    const displayName =
      getAttr([
        'displayName',
        'name',
        'http://schemas.microsoft.com/identity/claims/displayname',
      ]) ||
      (firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0]);

    return {
      email: email.toLowerCase(),
      nameId,
      issuer,
      displayName,
      firstName,
      lastName,
      externalId: nameId,
    };
  }

  /**
   * Provisions or syncs user and membership upon successful SSO assertion
   */
  public static async processSsoIdentity(identity: SamlIdentity, orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!org) {
      throw new Error('Target organization not found');
    }

    // Verify domain restrictions if enforceSso or allowedDomains configured
    if (org.allowedDomains && org.allowedDomains.length > 0) {
      const emailDomain = identity.email.split('@')[1];
      const isAllowed = org.allowedDomains.some(
        (domain: string) => domain.toLowerCase() === emailDomain?.toLowerCase()
      );
      if (!isAllowed) {
        throw new Error(
          `Domain @${emailDomain} is not authorized for SSO access to ${org.name}.`
        );
      }
    }

    // Find or create User
    let user = await prisma.user.findUnique({
      where: { email: identity.email },
    });

    if (!user) {
      // Auto-provision user
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email: identity.email,
          displayName: identity.displayName || identity.email.split('@')[0],
          passwordHash,
          isActive: true,
          externalId: identity.externalId || identity.nameId,
        },
      });
    } else {
      // Ensure user is active
      if (!user.isActive) {
        throw new Error('Account has been deactivated. Please contact your Enterprise Administrator.');
      }
      // Update externalId if missing
      if (!user.externalId && identity.externalId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { externalId: identity.externalId },
        });
      }
    }

    // Ensure OrgMembership exists
    let membership = await prisma.orgMembership.findUnique({
      where: {
        orgId_userId: {
          orgId: org.id,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      // Automated provisioning of Member role
      membership = await prisma.orgMembership.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: 'MEMBER',
          isActive: true,
        },
      });
    } else if (!membership.isActive) {
      membership = await prisma.orgMembership.update({
        where: { id: membership.id },
        data: { isActive: true },
      });
    }

    // Issue standard LeadDesk auth tokens
    const accessToken = TokenService.signAccessToken({
      userId: user.id,
      email: user.email,
    });

    const refreshDetails = TokenService.generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        tokenHash: refreshDetails.tokenHash,
        userId: user.id,
        expiresAt: refreshDetails.expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        timezone: user.timezone,
        orgId: org.id,
        orgName: org.name,
        role: membership.role,
      },
      accessToken,
      refreshToken: refreshDetails.rawToken,
    };
  }
}
