import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { ScrapedDocument, Storage } from './types';

export const createMongoStorage = async (uri: string): Promise<Storage> => {
  const client = new MongoClient(uri);
  await client.connect();

  const db: Db = client.db('scrapient');
  const collection: Collection<ScrapedDocument> = db.collection('documents');

  await collection.createIndex({ url: 1 });
  await collection.createIndex({ domain: 1 });
  await collection.createIndex({ scrapedAt: -1 });

  const generateId = (): string => new ObjectId().toHexString();

  return {
    save: async (document: Omit<ScrapedDocument, 'id'>): Promise<string> => {
      const id = generateId();
      const docWithId: ScrapedDocument = {
        ...document,
        id,
        scrapedAt: new Date(document.scrapedAt)
      };

      await collection.insertOne(docWithId);
      return id;
    },

    findById: async (id: string): Promise<ScrapedDocument | null> => {
      // Try to find by custom id field first, then by MongoDB _id
      let document = await collection.findOne({ id });

      if (!document) {
        try {
          // Try to find by MongoDB _id (for legacy documents)
          document = await collection.findOne({ _id: new ObjectId(id) });
        } catch (error) {
          // If id is not a valid ObjectId, just return null
          return null;
        }
      }

      return document || null;
    },

    findAll: async (options = {}): Promise<ScrapedDocument[]> => {
      const { limit = 50, offset = 0 } = options;

      const documents = await collection
        .find({})
        .sort({ scrapedAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return documents;
    },

    deleteById: async (id: string): Promise<boolean> => {
      const result = await collection.deleteOne({ id });
      return result.deletedCount === 1;
    },

    deleteMany: async (ids: string[]): Promise<number> => {
      const result = await collection.deleteMany({ id: { $in: ids } });
      return result.deletedCount;
    },

    close: async (): Promise<void> => {
      await client.close();
    }
  };
};