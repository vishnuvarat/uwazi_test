import db from 'api/utils/testing_db';
import { search } from 'api/search/search';
import { UserInContextMockFactory } from 'api/utils/testingUserInContext';

import { Aggregations, AggregationBucket } from 'shared/types/aggregations';
import { UserSchema } from 'shared/types/userType';
import { ObjectIdSchema } from 'shared/types/commonTypes';
import { fixturesTimeOut } from './fixtures_elastic';
import {
  permissionsLevelFixtures,
  users,
  group1,
  template1Id,
  template2Id,
  template3Id,
} from './permissionsFiltersFixtures';

function getAggregationCountByType(typesBuckets: AggregationBucket[], templateId: ObjectIdSchema) {
  return typesBuckets.find(a => a.key === templateId.toString())?.filtered.doc_count;
}

describe('Permissions filters', () => {
  let buckets: AggregationBucket[];
  const user3WithGroups = { ...users.user3, groups: [{ _id: group1.toString() }] };
  const userFactory = new UserInContextMockFactory();

  beforeAll(async () => {
    await db.setupFixturesAndContext(permissionsLevelFixtures, 'permissionslevelfixtures');
    userFactory.restore();
  }, fixturesTimeOut);

  afterAll(async () => {
    await db.disconnect();
    userFactory.restore();
  });

  describe('when selecting permissions', () => {
    describe('when user is admin/editor', () => {
      it.each([users.adminUser, users.editorUser])(
        'should return all permissions for the entity',
        async user => {
          userFactory.mock(user);
          const query = {
            include: ['permissions'],
            searchTerm: 'ent3 ent4',
            unpublished: true,
          };

          const { rows } = await search.search(query, 'es', user);
          expect(rows[0].permissions).toEqual([
            { level: 'write', refId: users.user2._id.toString(), type: 'user' },
            { level: 'write', refId: users.user3._id.toString(), type: 'user' },
            { level: 'write', refId: group1.toString(), type: 'group' },
            { level: 'write', refId: users.adminUser._id.toString(), type: 'user' },
            { level: 'write', refId: users.editorUser._id.toString(), type: 'user' },
          ]);

          expect(rows[1].permissions).toEqual([
            { level: 'write', refId: users.user1._id.toString(), type: 'user' },
            { level: 'read', refId: users.user2._id.toString(), type: 'user' },
            { level: 'write', refId: users.user3._id.toString(), type: 'user' },
            { level: 'read', refId: group1.toString(), type: 'group' },
            { level: 'read', refId: users.adminUser._id.toString(), type: 'user' },
          ]);
        }
      );
    });

    describe('when user is a collaborator', () => {
      it('should return only allowed to see permissions', async () => {
        userFactory.mock(users.user2);
        const query = {
          include: ['permissions'],
          unpublished: true,
        };

        const { rows } = await search.search(query, 'es', users.user2);
        expect(rows).toEqual([
          expect.objectContaining({
            permissions: expect.arrayContaining([]),
          }),
          expect.objectContaining({
            permissions: expect.arrayContaining([
              { level: 'write', refId: users.user2._id.toString(), type: 'user' },
            ]),
          }),
        ]);
      });
    });
  });

  describe('filters', () => {
    it('should return results based on what the user is allowed to see', async () => {
      userFactory.mock(users.user2);
      const query = { unpublished: true };

      const { rows } = await search.search(query, 'es', users.user2);
      expect(rows).toEqual([
        expect.objectContaining({ title: 'ent3' }),
        expect.objectContaining({ title: 'ent4' }),
      ]);
    });

    it('should not return entities for which the user does not have permissions', async () => {
      userFactory.mock(users.user2);
      const query = { searchTerm: 'ent1', unpublished: true };

      const { rows } = await search.search(query, 'es', users.user2);
      expect(rows).toEqual([]);
    });

    describe('when filtering by permissions level', () => {
      it('should return only entities that I can see and match the filter', async () => {
        userFactory.mock(users.user2);
        const query = {
          customFilters: { 'permissions.level': { values: ['write'] } },
          unpublished: true,
        };
        const { rows } = await search.search(query, 'es', users.user2);
        expect(rows).toEqual([expect.objectContaining({ title: 'ent4' })]);
      });

      it('should return entities that admin/editor have explicit permissions', async () => {
        userFactory.mock(users.adminUser);
        const query = {
          customFilters: { 'permissions.level': { values: ['write'] } },
          unpublished: true,
        };

        const { rows: adminRows } = await search.search(query, 'es', users.adminUser);
        expect(adminRows).toEqual([
          expect.objectContaining({ title: 'ent2' }),
          expect.objectContaining({ title: 'ent4' }),
        ]);

        userFactory.mock(users.editorUser);
        const { rows: editorRows } = await search.search(query, 'es', users.adminUser);
        expect(editorRows).toEqual([expect.objectContaining({ title: 'ent4' })]);
      });
    });
  });

  describe('permissions aggregations based on access level ', () => {
    const performSearch = async (user: UserSchema): Promise<AggregationBucket[]> => {
      const response = await search.search(
        { aggregatePermissionsByLevel: true, unpublished: true },
        'es',
        user
      );
      const aggs = response.aggregations as Aggregations;
      return aggs.all.permissions.buckets;
    };

    it.each`
      user                | expect1 | expect2
      ${users.user1}      | ${2}    | ${1}
      ${users.user2}      | ${1}    | ${1}
      ${user3WithGroups}  | ${3}    | ${2}
      ${users.adminUser}  | ${1}    | ${2}
      ${users.editorUser} | ${1}    | ${1}
    `(
      'should return aggregations of permission level filtered per current user',
      async ({ user, expect1, expect2 }) => {
        userFactory.mock(user);
        buckets = await performSearch(user);
        expect(buckets.find(a => a.key === 'read')?.filtered.doc_count).toBe(expect1);
        expect(buckets.find(a => a.key === 'write')?.filtered.doc_count).toBe(expect2);
      }
    );
  });

  describe('type aggregations based on read access to entities', () => {
    it.each`
      user                | template1Count | template2Count | template3Count
      ${users.user1}      | ${2}           | ${1}           | ${0}
      ${users.user2}      | ${1}           | ${0}           | ${1}
      ${user3WithGroups}  | ${2}           | ${1}           | ${1}
      ${users.editorUser} | ${2}           | ${1}           | ${1}
    `(
      'should return aggregations of matched entities having into account read permission',
      async ({ user, template1Count, template2Count, template3Count }) => {
        userFactory.mock(user);
        const response = await search.search({ unpublished: true }, 'es', user);
        const typesBuckets = (response.aggregations as Aggregations).all._types.buckets;
        expect(getAggregationCountByType(typesBuckets, template1Id)).toBe(template1Count);
        expect(getAggregationCountByType(typesBuckets, template2Id)).toBe(template2Count);
        expect(getAggregationCountByType(typesBuckets, template3Id)).toBe(template3Count);
      }
    );
  });

  describe('public entities', () => {
    describe('when query published and user is a collaborator/editor', () => {
      it.each([users.user1, users.editorUser])('should see only public entities', async user => {
        userFactory.mock(user);
        const query = { published: true };
        const { rows, aggregations } = await search.search(query, 'es', users.user2);
        const typesBuckets = (aggregations as Aggregations).all._types.buckets;
        expect(rows).toEqual([
          expect.objectContaining({ title: 'entPublic1' }),
          expect.objectContaining({ title: 'entPublic2' }),
        ]);
        expect(getAggregationCountByType(typesBuckets, template1Id)).toBe(1);
        expect(getAggregationCountByType(typesBuckets, template3Id)).toBe(1);
      });
    });

    describe('when query includeUnpublished and user is collaborator', () => {
      it('should see public and authorized entities', async () => {
        userFactory.mock(users.user2);
        const query = { includeUnpublished: true };
        const { rows, aggregations } = await search.search(query, 'es', users.user2);
        const typesBuckets = (aggregations as Aggregations).all._types.buckets;
        expect(rows).toEqual([
          expect.objectContaining({ title: 'ent3' }),
          expect.objectContaining({ title: 'ent4' }),
          expect.objectContaining({ title: 'entPublic1' }),
          expect.objectContaining({ title: 'entPublic2' }),
        ]);
        expect(getAggregationCountByType(typesBuckets, template1Id)).toBe(2);
        expect(getAggregationCountByType(typesBuckets, template3Id)).toBe(2);
      });
    });

    describe('when query includeUnpublished and user is editor/admin', () => {
      it.each([users.adminUser, users.editorUser])(
        'should see public and authorized entities',
        async user => {
          userFactory.mock(user);
          const query = { includeUnpublished: true };
          const { rows, aggregations } = await search.search(query, 'es', user);
          const typesBuckets = (aggregations as Aggregations).all._types.buckets;
          expect(rows).toEqual([
            expect.objectContaining({ title: 'ent1' }),
            expect.objectContaining({ title: 'ent2' }),
            expect.objectContaining({ title: 'ent3' }),
            expect.objectContaining({ title: 'ent4' }),
            expect.objectContaining({ title: 'entPublic1' }),
            expect.objectContaining({ title: 'entPublic2' }),
          ]);
          expect(getAggregationCountByType(typesBuckets, template1Id)).toBe(3);
          expect(getAggregationCountByType(typesBuckets, template3Id)).toBe(2);
        }
      );
    });
  });
});
