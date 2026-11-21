import { prisma } from '../common/prisma';
import { SamlService } from '../modules/auth/sso/saml.service';
import { ScimService } from '../modules/scim/scim.service';
import { OrganizationsService } from '../modules/organizations/organizations.service';

async function runTest() {
  console.log('🧪 Starting Enterprise Identity (SAML 2.0 & SCIM 2.0) Verification Test...\n');

  // 1. Locate test organization
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!org) {
    throw new Error('No organization found. Please run backfill-tenants first.');
  }

  console.log(`[1] Found Target Organization: "${org.name}" (${org.id})`);

  // 2. Configure SAML SSO on organization
  console.log('[2] Configuring SAML SSO Settings...');
  const updatedOrg = await OrganizationsService.updateSsoConfig(org.id, {
    ssoEnabled: true,
    ssoProvider: 'OKTA',
    ssoEntityId: 'http://test-idp.okta.com',
    ssoLoginUrl: 'https://test-idp.okta.com/app/leaddesk/sso/saml',
    allowedDomains: ['acme-corp.internal', 'enterprise-pilot.com'],
    enforceSso: false,
  });

  console.log('    ✅ SSO Config saved:', {
    ssoEnabled: updatedOrg.ssoEnabled,
    ssoProvider: updatedOrg.ssoProvider,
    allowedDomains: updatedOrg.allowedDomains,
  });

  // 3. Test Service Provider Metadata Generation
  console.log('[3] Generating SAML SP Metadata XML...');
  const metadataXml = SamlService.generateSpMetadata(org.id, 'http://localhost:4000');
  if (!metadataXml.includes('EntityDescriptor') || !metadataXml.includes('AssertionConsumerService')) {
    throw new Error('SP Metadata XML missing essential SAML descriptors');
  }
  console.log('    ✅ SP Metadata XML valid (length: ' + metadataXml.length + ' chars)');

  // 4. Test AuthnRequest Generation
  console.log('[4] Generating SAML AuthnRequest...');
  const authnReq = SamlService.generateAuthnRequest(org, 'http://localhost:4000');
  if (!authnReq.redirectUrl || !authnReq.samlRequest) {
    throw new Error('AuthnRequest generation failed');
  }
  console.log('    ✅ SAML AuthnRequest generated redirect URL:', authnReq.redirectUrl.substring(0, 80) + '...');

  // 5. Test SAML Assertion Parsing & Automated User Provisioning
  console.log('[5] Simulating SAML 2.0 Assertion Response exchange...');
  const testEmail = 'saml.engineer@enterprise-pilot.com';
  const testSamlXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" Version="2.0">
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
  <saml:Assertion Version="2.0">
    <saml:Issuer>http://test-idp.okta.com</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${testEmail}</saml:NameID>
    </saml:Subject>
    <saml:AttributeStatement>
      <saml:Attribute Name="email"><saml:AttributeValue>${testEmail}</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="firstName"><saml:AttributeValue>Marcus</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="lastName"><saml:AttributeValue>Vance</saml:AttributeValue></saml:Attribute>
      <saml:Attribute Name="displayName"><saml:AttributeValue>Marcus Vance</saml:AttributeValue></saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

  const base64Saml = Buffer.from(testSamlXml).toString('base64');
  const parsedIdentity = SamlService.parseSamlResponse(base64Saml, 'http://test-idp.okta.com');
  console.log('    ✅ Parsed SAML identity:', {
    email: parsedIdentity.email,
    displayName: parsedIdentity.displayName,
    externalId: parsedIdentity.externalId,
  });

  const authSession = await SamlService.processSsoIdentity(parsedIdentity, org.id);
  console.log('    ✅ Auto-provisioned user via SSO:', {
    userId: authSession.user.id,
    email: authSession.user.email,
    orgName: authSession.user.orgName,
    role: authSession.user.role,
    accessTokenLength: authSession.accessToken.length,
  });

  // 6. Test SCIM 2.0 Token Generation
  console.log('\n[6] Generating SCIM 2.0 Bearer API Token...');
  const scimConfig = await OrganizationsService.generateScimToken(org.id);
  if (!scimConfig.scimApiKey || !scimConfig.scimEnabled) {
    throw new Error('Failed to generate SCIM API key');
  }
  console.log('    ✅ SCIM Enabled:', scimConfig.scimEnabled, '| Key:', scimConfig.scimApiKey.substring(0, 18) + '...');

  // 7. Test SCIM 2.0 User Provisioning (POST /scim/v2/Users)
  console.log('[7] Provisioning Employee via SCIM 2.0 POST /Users...');
  const scimEmail = 'scim.pilot@enterprise-pilot.com';
  const scimPayload = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: scimEmail,
    displayName: 'Elena Rostova',
    name: { formatted: 'Elena Rostova', givenName: 'Elena', familyName: 'Rostova' },
    title: 'Staff Security Engineer',
    department: 'Infrastructure Security',
    active: true,
    emails: [{ value: scimEmail, primary: true, type: 'work' }],
  };

  const createdScimUser = await ScimService.createUser(org.id, scimPayload, 'http://localhost:4000');
  console.log('    ✅ SCIM User created:', {
    id: createdScimUser.id,
    userName: createdScimUser.userName,
    title: createdScimUser.title,
    department: createdScimUser.department,
    active: createdScimUser.active,
  });

  // 8. Test SCIM 2.0 List & Filter (GET /scim/v2/Users?filter=...)
  console.log('[8] Testing SCIM List & Filter expression...');
  const listResult = await ScimService.listUsers(org.id, `userName eq "${scimEmail}"`, 1, 10);
  if (listResult.totalResults < 1 || listResult.Resources[0].userName !== scimEmail) {
    throw new Error('SCIM filter lookup failed');
  }
  console.log(`    ✅ SCIM filter found ${listResult.totalResults} matching user(s).`);

  // 9. Test SCIM 2.0 Patch De-provisioning (PATCH /scim/v2/Users/:id -> active: false)
  console.log('[9] Simulating Offboarding via SCIM 2.0 PATCH (active: false)...');
  const patchResult = await ScimService.patchUser(
    org.id,
    createdScimUser.id,
    [{ op: 'replace', path: 'active', value: false }],
    'http://localhost:4000'
  );

  console.log('    ✅ SCIM User after deactivation:', {
    id: patchResult.id,
    active: patchResult.active,
  });

  if (patchResult.active !== false) {
    throw new Error('User was not deactivated by SCIM patch operation');
  }

  // 10. Test SCIM 2.0 User Deletion (DELETE /scim/v2/Users/:id)
  console.log('[10] Testing SCIM 2.0 DELETE (Safe Offboarding cascade)...');
  await ScimService.deleteUser(org.id, createdScimUser.id);
  console.log('    ✅ User de-provisioned successfully from organization.');

  console.log('\n🎉 ALL ENTERPRISE IDENTITY (SAML 2.0 & SCIM 2.0) TESTS PASSED SUCCESSFULLY! 🚀');
}

runTest()
  .catch((e) => {
    console.error('❌ Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
