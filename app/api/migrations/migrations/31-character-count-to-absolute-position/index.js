/* eslint-disable no-await-in-loop */
import { PdfCharacterCountToAbsolute } from 'api/migrations/pdf_character_count_to_absolute/PdfCharacterCountToAbsolute';
import path from 'path';
import { config } from 'api/config';
import { ObjectId } from 'mongodb';

const absolutePositionReferenceToTextSelection = absolutePositionReference => {
  const { pageHeight } = absolutePositionReference;
  const textSelectionRectangles = absolutePositionReference.selectionRectangles.map(x => ({
    left: Math.round((1100 * x.left) / pageHeight),
    top: Math.round((1100 * x.top) / pageHeight),
    width: Math.round((1100 * x.width) / pageHeight),
    height: Math.round((1100 * x.height) / pageHeight),
    regionId: x.pageNumber,
  }));

  return {
    text: absolutePositionReference.text,
    selectionRectangles: textSelectionRectangles,
  };
};

async function convertToAbsolutePosition(connection, db) {
  const files = await db
    .collection('files')
    .find({ _id: ObjectId(connection.file) })
    .toArray();

  if (files[0].pdfInfo) {
    const filename = path.join(config.defaultTenant.uploadedDocuments, files[0].filename);
    const pageEndingCharacterCount = Object.values(files[0].pdfInfo).map(x => x.chars);

    const characterCountToAbsoluteConversion = new PdfCharacterCountToAbsolute();
    await characterCountToAbsoluteConversion.loadPdf(filename, pageEndingCharacterCount);

    const absolutePositionReference = characterCountToAbsoluteConversion.convert(
      connection.range.text,
      connection.range.start,
      connection.range.end
    );
    const textSelection = absolutePositionReferenceToTextSelection(absolutePositionReference);

    await db
      .collection('connections')
      .updateOne({ _id: connection._id }, { $set: { reference: textSelection } });
  }

  await db.collection('connections').updateOne({ _id: connection._id }, { $unset: { range: '' } });
}

export default {
  delta: 31,

  name: 'character-count-to-absolute-position',

  description: 'Convert the character count of pdf references to absolute position',

  async up(db) {
    let tocCount = 0;
    process.stdout.write(`${this.name}...\r\n`);
    const cursor = db.collection('connections').find();

    while (await cursor.hasNext()) {
      const connection = await cursor.next();
      if (connection.file && connection.range) {
        tocCount += 1;
        process.stdout.write(
          `${tocCount} converting to absolute position connection ${connection._id} file ${connection.file}\r\n`
        );
        await convertToAbsolutePosition(connection, db);
      }
    }

    process.stdout.write('\r\n');
  },
};
