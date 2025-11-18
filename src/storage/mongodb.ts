import { MongoClient, Db, Collection, ObjectId } from 'mongodb';
import type { ScrapedDocument, KnowledgeGraphStorage, Storage } from './types';

export const createMongoStorage = async (uri: string): Promise<Storage> => {
  const client = new MongoClient(uri);
  await client.connect();

  const db: Db = client.db('scrapient');
  const collection: Collection<ScrapedDocument> = db.collection('documents');
  const kgCollection: Collection<KnowledgeGraphStorage> = db.collection('knowledge_graphs');

  await collection.createIndex({ url: 1 });
  await collection.createIndex({ domain: 1 });
  await collection.createIndex({ scrapedAt: -1 });

  // Create indexes for KG collection
  await kgCollection.createIndex({ generatedAt: -1 });
  await kgCollection.createIndex({ sourceDocumentIds: 1 });
  await kgCollection.createIndex({ 'metadata.stage': 1 });

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

    // Knowledge Graph operations
    saveKG: async (kg: Omit<KnowledgeGraphStorage, 'id'>): Promise<string> => {
      const id = generateId();
      const kgWithId: KnowledgeGraphStorage = {
        ...kg,
        id,
        generatedAt: new Date(kg.generatedAt),
        updatedAt: new Date(kg.updatedAt)
      };

      await kgCollection.insertOne(kgWithId);
      return id;
    },

    findKGById: async (id: string): Promise<KnowledgeGraphStorage | null> => {
      const kg = await kgCollection.findOne({ id });
      return kg || null;
    },

    findAllKGs: async (options = {}): Promise<KnowledgeGraphStorage[]> => {
      const { limit = 50, offset = 0 } = options;

      const kgs = await kgCollection
        .find({})
        .sort({ generatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray();

      return kgs;
    },

    updateKG: async (id: string, updates: Partial<KnowledgeGraphStorage>): Promise<boolean> => {
      // Convert dates if provided
      const processedUpdates = { ...updates };
      if (processedUpdates.updatedAt) {
        processedUpdates.updatedAt = new Date(processedUpdates.updatedAt);
      }
      if (processedUpdates.generatedAt) {
        processedUpdates.generatedAt = new Date(processedUpdates.generatedAt);
      }

      const result = await kgCollection.updateOne(
        { id },
        { $set: processedUpdates }
      );
      return result.modifiedCount === 1;
    },

    deleteKGById: async (id: string): Promise<boolean> => {
      const result = await kgCollection.deleteOne({ id });
      return result.deletedCount === 1;
    },

    close: async (): Promise<void> => {
      await client.close();
    }
  };
};