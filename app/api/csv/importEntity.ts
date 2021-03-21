import entities from 'api/entities';
import { search } from 'api/search';
import entitiesModel from 'api/entities/entitiesModel';
import { processDocument } from 'api/files/processDocument';
import { RawEntity } from 'api/csv/entityRow';
import { TemplateSchema } from 'shared/types/templateType';
import { MetadataSchema, PropertySchema, MetadataObjectSchema } from 'shared/types/commonTypes';
import { ImportFile } from 'api/csv/importFile';
import { EntitySchema } from 'shared/types/entityType';
import { ensure } from 'shared/tsUtils';

import typeParsers from './typeParsers';
import { attachmentsPath, files } from 'api/files';

const parse = async (toImportEntity: RawEntity, prop: PropertySchema) =>
  typeParsers[prop.type]
    ? typeParsers[prop.type](toImportEntity, prop)
    : typeParsers.text(toImportEntity, prop);

const toMetadata = async (
  template: TemplateSchema,
  toImportEntity: RawEntity
): Promise<MetadataSchema> =>
  (template.properties || [])
    .filter(prop => (prop.name ? toImportEntity[prop.name] : false))
    .reduce<Promise<MetadataSchema>>(
      async (meta, prop) =>
        ({
          ...(await meta),
          [ensure<string>(prop.name)]: await parse(toImportEntity, prop),
        } as MetadataSchema),
      Promise.resolve({})
    );

const currentEntityIdentifiers = async (sharedId: string, language: string) =>
  sharedId ? entities.get({ sharedId, language }, '_id sharedId').then(([e]) => e) : {};

const entityObject = async (
  toImportEntity: RawEntity,
  template: TemplateSchema,
  { language }: Options
) => ({
  title: toImportEntity.title,
  template: template._id,
  metadata: await toMetadata(template, toImportEntity),
  ...(await currentEntityIdentifiers(toImportEntity.id, language)),
});

type Options = {
  user?: {};
  language: string;
};

const extractAttachmentsFromProp = async (valueObject: MetadataObjectSchema, entity: string) => {
  const attachment = await files.save({
    entity,
    type: 'attachment',
    url: String(valueObject.value),
  });
  return attachment._id.toString();
};

const extractAttachmentsFromMediaProps = async (
  template: TemplateSchema,
  _metadata: MetadataSchema,
  sharedId: string
) => {
  const metadata = { ..._metadata };

  const extractions = template.properties
    ? template.properties.map(async prop => {
        if (['image', 'media'].includes(prop.type) && metadata[prop.name] && sharedId) {
          const propertyMO = metadata[prop.name];

          const extractOneProp = propertyMO
            ? propertyMO.map(async (valueObject: MetadataObjectSchema) => {
                if (valueObject.value) {
                  const attachmentId = await extractAttachmentsFromProp(valueObject, sharedId);
                  valueObject.value = attachmentId;
                }
              })
            : [];

          return Promise.all(extractOneProp);
        }

        return Promise.resolve();
      })
    : [];

  await Promise.all(extractions);
  return metadata;
};

const importEntity = async (
  toImportEntity: RawEntity,
  template: TemplateSchema,
  importFile: ImportFile,
  { user = {}, language }: Options
) => {
  const attachments = toImportEntity.attachments;
  delete toImportEntity.attachments;
  const eo = await entityObject(toImportEntity, template, { language });
  const entity = await entities.save({ ...eo, metadata: {} }, { user, language }, true, false);

  // const entity = await entities.save(eo, { user, language }, true, false);

  if (toImportEntity.file && entity.sharedId) {
    const file = await importFile.extractFile(toImportEntity.file);
    await processDocument(entity.sharedId, file);
  }

  if (attachments && entity.sharedId) {
    await attachments.split('|').reduce(async (promise: Promise<any>, attachment) => {
      await promise;
      const attachmentFile = await importFile.extractFile(attachment, attachmentsPath());
      return files.save({ ...attachmentFile, entity: entity.sharedId, type: 'attachment' });
    }, Promise.resolve());
  }

  if (entity.sharedId) {
    const metadataWithAttachments = await extractAttachmentsFromMediaProps(
      template,
      eo.metadata,
      entity.sharedId
    );

    entity.metadata = metadataWithAttachments;
  }

  await entities.save(entity, { user, language }, true, false);
  await search.indexEntities({ sharedId: entity.sharedId }, '+fullText');
  return entity;
};

const translateEntity = async (
  entity: EntitySchema,
  translations: RawEntity[],
  template: TemplateSchema,
  importFile: ImportFile
) => {
  await entitiesModel.saveMultiple(
    await Promise.all(
      translations.map(async translatedEntity =>
        entityObject({ ...translatedEntity, id: ensure(entity.sharedId) }, template, {
          language: translatedEntity.language,
        })
      )
    )
  );

  await Promise.all(
    translations.map(async translatedEntity => {
      if (translatedEntity.file) {
        const file = await importFile.extractFile(translatedEntity.file);
        await processDocument(ensure(entity.sharedId), file);
      }
    })
  );

  await search.indexEntities({ sharedId: entity.sharedId }, '+fullText');
};

export { importEntity, translateEntity };
