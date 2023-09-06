import testingDB from 'api/utils/testing_db';
import migration from '../index.js';
import fixtures, { templateContext } from './fixtures.js';

describe('migration update translations of new Languages UI', () => {
  beforeEach(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    await testingDB.setupFixturesAndContext(fixtures);
  });

  afterAll(async () => {
    await testingDB.disconnect();
  });

  it('should have a delta number', () => {
    expect(migration.delta).toBe(137);
  });

  it('should update the keys that have changed', async () => {
    await migration.up(testingDB.mongodb);
    const allTranslations = await testingDB.mongodb.collection('translations').find().toArray();

    const uwaziUI = allTranslations.filter(tr =>
      tr.contexts.filter(ctx => ctx.type === 'Uwazi UI')
    );

    const previousSystemValues = {
      key: 'existing-key-in-system',
      value: 'existing-key-in-system',
    };

    const addedKeys = [
      { key: 'Copy to clipboard' },
      { key: 'Account updated' },
      { key: 'General Information' },
      { key: 'User Role' },
      { key: 'Change Password' },
      { key: 'New Password' },
      { key: 'Passwords do not match' },
      { key: 'Confirm New Passowrd' },
      { key: 'Two-Factor Authentication' },
      { key: 'Activated' },
      { key: "Your account's security is enhanced with two-factor authentication." },
      { key: 'Enable' },
      { key: 'You should activate this feature for enhanced account security.' },
      { key: '2FA Enabled' },
      { key: 'Using Authenticator' },
      { key: 'Download a third-party authenticator app from your mobile store.' },
      {
        key: 'Add an account to the app by scanning the provided QR code with your mobile device or by inserting the provided key.',
      },
      {
        key: "Instructions on how to achieve this will vary according to the app used, please refer to the app's documentation.",
      },
      { key: 'QR Code' },
      { key: 'Secret keys' },
      { key: 'You can also enter this secret key into your Authenticator app.' },
      { key: "*please keep this key secret and don't share it." },
      { key: 'Enter the 6-digit verification code generated by your Authenticator app' },
      { key: 'The token does not validate against the secret key' },
    ].map(key => ({ ...key, value: key.key }));

    const defaultContextContent = expect.objectContaining({
      type: 'Uwazi UI',
      values: expect.arrayContaining([previousSystemValues, ...addedKeys]),
    });
    expect(uwaziUI).toMatchObject([
      expect.objectContaining({
        locale: 'en',
        contexts: [defaultContextContent, templateContext],
      }),
      expect.objectContaining({
        locale: 'es',
        contexts: [
          expect.objectContaining({
            type: 'Uwazi UI',
            values: [previousSystemValues, ...addedKeys],
          }),
          templateContext,
        ],
      }),
      expect.objectContaining({
        locale: 'pt',
        contexts: [defaultContextContent, templateContext],
      }),
    ]);
  });
});