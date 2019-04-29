import Joi from 'joi';
import multer from 'multer';

import debugLog from 'api/log/debugLog';
import entities from 'api/entities';
import errorLog from 'api/log/errorLog';
import relationships from 'api/relationships';

import { validateRequest } from '../utils';
import needsAuthorization from '../auth/authMiddleware';
import uploads from './uploads';
import storageConfig from './storageConfig';
import uploadFile from './uploadProcess';

const storage = multer.diskStorage(storageConfig);

const getDocuments = (sharedId, allLanguages, language) =>
  entities.get({
    sharedId,
    ...(!allLanguages && { language })
  });

export default (app) => {
  const upload = multer({ storage });

  const socket = req => req.getCurrentSessionSockets();

  const uploadProcess = async (req, res, allLanguages = true) => {
    try {
      const docs = await getDocuments(req.body.document, allLanguages, req.language);

      await uploadFile(docs, req.files[0])
      .on('conversionStart', () => {
        res.json(req.files[0]);
        socket(req).emit('conversionStart', req.body.document);
      })
      .start();

      socket(req).emit('documentProcessed', req.body.document);
    } catch (err) {
      errorLog.error(err);
      debugLog.debug(err);
      socket(req).emit('conversionFailed', req.body.document);
    }
  };

  app.post(
    '/api/upload',

    needsAuthorization(['admin', 'editor']),

    upload.any(),

    validateRequest(Joi.object({
      document: Joi.string().required()
    }).required()),

    (req, res) => uploadProcess(req, res)
  );

  app.post('/api/customisation/upload', needsAuthorization(['admin', 'editor']), upload.any(), (req, res, next) => {
    uploads.save(req.files[0])
    .then((saved) => {
      res.json(saved);
    })
    .catch(next);
  });

  app.get('/api/customisation/upload', needsAuthorization(['admin', 'editor']), (req, res, next) => {
    uploads.get()
    .then((result) => {
      res.json(result);
    })
    .catch(next);
  });

  app.delete(
    '/api/customisation/upload',

    needsAuthorization(['admin', 'editor']),

    validateRequest(Joi.object({
      _id: Joi.string().required()
    }).required(), 'query'),

    (req, res, next) => {
      uploads.delete(req.query._id)
      .then((result) => {
        res.json(result);
      })
      .catch(next);
    }
  );

  app.post(
    '/api/reupload',

    needsAuthorization(['admin', 'editor']),

    upload.any(),

    validateRequest(Joi.object({
      document: Joi.string().required()
    }).required()),

    (req, res, next) => entities.getById(req.body.document, req.language)
    .then((doc) => {
      let deleteReferences = Promise.resolve();
      if (doc.file) {
        deleteReferences = relationships.deleteTextReferences(doc.sharedId, doc.language);
      }
      return Promise.all([doc, deleteReferences]);
    })
    .then(([doc]) => entities.saveMultiple([{ _id: doc._id, toc: [] }]))
    .then(([{ sharedId }]) => entities.get({ sharedId }))
    .then(docs => docs.reduce((addToAllLanguages, doc) => addToAllLanguages && !doc.file, true))
    .then(addToAllLanguages => uploadProcess(req, res, addToAllLanguages))
    .catch(next)
  );
};
