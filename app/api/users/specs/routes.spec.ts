import { setUpApp } from 'api/utils/testingRoutes';
import request from 'supertest';

import { NextFunction, Request, Response } from 'express';
import { UserRole } from 'shared/types/userSchema';
import { UserSchema } from 'shared/types/userType';
import userRoutes from '../routes.js';
import users from '../users.js';
import { testingTenants } from '../../utils/testingTenants';

jest.mock(
  '../../utils/languageMiddleware.ts',
  () => (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = { username: 'user 1', role: 'admin' };
    next();
  }
);

const invalidUserProperties = [
  { field: 'username', value: undefined, dataPath: '.body', keyword: 'required' },
  { field: 'email', value: undefined, dataPath: '.body', keyword: 'required' },
  { field: 'role', value: undefined, dataPath: '.body', keyword: 'required' },
  { field: 'username', value: '', dataPath: '.body.username', keyword: 'minLength' },
  { field: 'email', value: '', dataPath: '.body.email', keyword: 'minLength' },
  { field: 'role', value: 'INVALID', dataPath: '.body.role', keyword: 'enum' },
  { field: 'password', value: '', dataPath: '.body.password', keyword: 'minLength' },
];

describe('users routes', () => {
  let currentUser: UserSchema | undefined;

  const userToUpdate = {
    username: 'User 1',
    role: UserRole.EDITOR,
    email: 'user@test.com',
  };
  function getUser() {
    return currentUser;
  }
  const app = setUpApp(userRoutes, (req: Request, _res: Response, next: NextFunction) => {
    (req as any).user = getUser();
    next();
  });

  beforeEach(() => {
    currentUser = {
      _id: 'admin1',
      username: 'Admin 1',
      role: UserRole.ADMIN,
      email: 'admin@test.com',
    };
  });

  describe('POST', () => {
    describe('/users', () => {
      beforeEach(() => {
        spyOn(users, 'save').and.returnValue(Promise.resolve());
      });

      it('should call users save with the body', async () => {
        await request(app)
          .post('/api/users')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send(userToUpdate);

        expect(users.save).toHaveBeenCalledWith(
          userToUpdate,
          currentUser,
          expect.stringContaining('http://127.0.0.1')
        );
      });

      describe('validation', () => {
        it.each(invalidUserProperties)(
          'should invalidate if there is an invalid property',
          async ({ field, value, dataPath, keyword }) => {
            // @ts-ignore
            const invalidUser = { ...userToUpdate, [field]: value };
            const response = await request(app)
              .post('/api/users')
              .set('X-Requested-With', 'XMLHttpRequest')
              .send(invalidUser);
            expect(response.status).toBe(400);
            expect(response.body.errors[0].dataPath).toEqual(dataPath);
            expect(response.body.errors[0].keyword).toEqual(keyword);
          }
        );
      });
    });

    describe('/users/new', () => {
      it('should call users newUser with the body', async () => {
        spyOn(users, 'newUser').and.returnValue(Promise.resolve());
        const response = await request(app)
          .post('/api/users/new')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send(userToUpdate);

        expect(response.status).toBe(200);
        expect(users.newUser).toHaveBeenCalledWith(
          userToUpdate,
          expect.stringContaining('http://127.0.0.1')
        );
      });

      describe('validation', () => {
        it.each(invalidUserProperties)(
          'should invalidate if there is an invalid property',
          async ({ field, value, dataPath, keyword }) => {
            // @ts-ignore
            const invalidUser = { ...userToUpdate, [field]: value };
            const response = await request(app)
              .post('/api/users/new')
              .set('X-Requested-With', 'XMLHttpRequest')
              .send(invalidUser);
            expect(response.status).toBe(400);
            expect(response.body.errors[0].dataPath).toEqual(dataPath);
            expect(response.body.errors[0].keyword).toEqual(keyword);
          }
        );
      });
    });

    describe('/recoverpassword', () => {
      it.each([
        { value: undefined, keyword: 'required' },
        { value: 'a', keyword: 'minLength' },
      ])('should invalidate if the schema is not matched', async ({ value, keyword }) => {
        const response = await request(app)
          .post('/api/recoverpassword')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ email: value });
        expect(response.status).toBe(400);
        expect(response.body.errors[0].keyword).toEqual(keyword);
      });

      it('should call users update with the body email', async () => {
        spyOn(users, 'recoverPassword').and.returnValue(Promise.resolve());
        const response = await request(app)
          .post('/api/recoverpassword')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ email: 'recover@me.com' });
        expect(response.status).toBe(200);
        expect(users.recoverPassword).toHaveBeenCalledWith(
          'recover@me.com',
          expect.stringContaining('http://127.0.0.1')
        );
      });

      it('should return an error if recover password fails', async () => {
        spyOn(users, 'recoverPassword').and.throwError('error on recoverPassword');
        testingTenants.mockCurrentTenant({ name: 'default' });
        const response = await request(app)
          .post('/api/recoverpassword')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ email: 'recover@me.com' });
        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Error: error on recoverPassword');
      });
    });

    describe('/resetpassword', () => {
      it.each([
        { key: 'key', password: undefined, keyword: 'required' },
        { key: undefined, password: 'pass', keyword: 'required' },
      ])('should invalidate if the schema is not matched', async ({ key, password, keyword }) => {
        const response = await request(app)
          .post('/api/resetpassword')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ key, password });
        expect(response.status).toBe(400);
        expect(response.body.errors[0].keyword).toEqual(keyword);
      });

      it('should call users update with the body', async () => {
        spyOn(users, 'resetPassword').and.returnValue(Promise.resolve());
        const response = await request(app)
          .post('/api/resetpassword')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ key: 'key', password: 'pass' });
        expect(response.status).toBe(200);
        expect(users.resetPassword).toHaveBeenCalledWith({ key: 'key', password: 'pass' });
      });
    });

    describe('/unlockaccount', () => {
      it.each([
        { username: 'name', code: undefined, keyword: 'required' },
        { username: undefined, code: 'code', keyword: 'required' },
      ])('should invalidate if the schema is not matched', async ({ username, code, keyword }) => {
        const response = await request(app)
          .post('/api/unlockaccount')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ username, code });
        expect(response.status).toBe(400);
        expect(response.body.errors[0].keyword).toEqual(keyword);
      });
      it('should call users.unlockAccount with the body', async () => {
        spyOn(users, 'unlockAccount').and.returnValue(Promise.resolve());
        const response = await request(app)
          .post('/api/unlockAccount')
          .set('X-Requested-With', 'XMLHttpRequest')
          .send({ username: 'user1', code: 'code' });
        expect(response.status).toBe(200);
        expect(users.unlockAccount).toHaveBeenCalledWith({ username: 'user1', code: 'code' });
      });
    });
  });

  describe('GET', () => {
    it('should need authorization', async () => {
      spyOn(users, 'get').and.returnValue(Promise.resolve(['users']));
      currentUser!.role = UserRole.EDITOR;
      const response = await request(app)
        .get('/api/users')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(response.status).toBe(401);
    });

    it('should call users get', async () => {
      spyOn(users, 'get').and.returnValue(Promise.resolve(['users']));
      const response = await request(app)
        .get('/api/users')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(response.status).toBe(200);
      expect(users.get).toHaveBeenCalled();
      expect(response.body).toEqual(['users']);
    });
  });

  describe('DELETE', () => {
    beforeEach(() => {
      spyOn(users, 'delete').and.returnValue(Promise.resolve({ json: 'ok' }));
    });

    it('should invalidate if the schema is not matched', async () => {
      const response = await request(app)
        .delete('/api/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .query({ _id: undefined });
      expect(response.status).toBe(400);
      expect(response.body.errors[0].keyword).toEqual('required');
    });

    it('should need authorization', async () => {
      currentUser!.role = UserRole.EDITOR;
      const response = await request(app)
        .delete('/api/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .query({ _id: 'user1' });
      expect(response.status).toBe(401);
    });

    it('should use users to delete it', async () => {
      const response = await request(app)
        .delete('/api/users')
        .set('X-Requested-With', 'XMLHttpRequest')
        .query({ _id: 'userToDeleteId' });
      expect(response.status).toBe(200);
      expect(users.delete).toHaveBeenCalledWith('userToDeleteId', currentUser);
    });
  });
});
