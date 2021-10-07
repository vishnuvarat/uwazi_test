import mongoose from 'mongoose';
import { instanceModel } from 'api/odm';

const props = {
  autoexpire: { type: Date, expires: 360000, default: Date.now },
  status: { type: String, enum: ['pending', 'completed', 'error'], default: 'pending' },
  error: { type: String },
  segmentation: {
    page_width: Number,
    page_height: Number,
    paragraphs: [
      {
        left: Number,
        top: Number,
        width: Number,
        height: Number,
        page_number: Number,
        text: String,
      },
    ],
  },
  fileID: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
  fileName: { type: String },
};

const mongoSchema = new mongoose.Schema(props, {
  emitIndexErrors: true,
  strict: false,
});

const SegmentationModel = instanceModel('segmentation', mongoSchema);

export { SegmentationModel };
