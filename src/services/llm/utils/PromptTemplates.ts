import type { AnalysisTask } from '../types';

export class PromptTemplates {

  static buildAnalysisPrompt(content: string, task: AnalysisTask): string {
    const basePrompt = this.getTaskPrompt(task);

    return `${basePrompt}

Document Content:
---
${content}
---

${this.getOutputInstructions(task)}`;
  }

  private static getTaskPrompt(task: AnalysisTask): string {
    switch (task.type) {
      case 'summarize':
        return `You are a document analysis expert. Your task is to create a concise, accurate summary of the provided document.

Guidelines:
- Focus on key points and main ideas
- Maintain the original context and meaning
- Keep the summary between 100-300 words
- Use clear, professional language
${task.instructions ? `\nAdditional instructions: ${task.instructions}` : ''}`;

      case 'extract_entities':
        return `You are an expert at extracting entities from documents. Your task is to identify and classify all important entities in the text.

Guidelines:
- Identify people, organizations, locations, and key concepts
- Classify each entity by type
- Provide confidence scores (0.0-1.0)
- Count mentions of each entity
- Focus on entities that are central to the document's meaning
${task.instructions ? `\nAdditional instructions: ${task.instructions}` : ''}`;

      case 'analyze_sentiment':
        return `You are a sentiment analysis expert. Your task is to analyze the emotional tone and sentiment of the provided document.

Guidelines:
- Determine overall sentiment (positive, negative, neutral)
- Provide a sentiment score from -1.0 (very negative) to 1.0 (very positive)
- Identify specific phrases that contribute to the sentiment
- Consider context and nuanced expressions
${task.instructions ? `\nAdditional instructions: ${task.instructions}` : ''}`;

      case 'generate_keywords':
        return `You are a keyword extraction expert. Your task is to identify the most important keywords and phrases from the document.

Guidelines:
- Extract 10-20 most relevant keywords
- Include both single words and key phrases
- Focus on terms that capture the document's core topics
- Rank keywords by importance and frequency
- Consider domain-specific terminology
${task.instructions ? `\nAdditional instructions: ${task.instructions}` : ''}`;

      case 'extract_relationships':
        return `You are an expert at identifying relationships between entities in documents. Your task is to extract meaningful connections and relationships.

Guidelines:
- Identify relationships between people, organizations, concepts, and locations
- Specify the type of relationship (works_for, located_in, causes, etc.)
- Provide confidence scores for each relationship
- Focus on explicitly stated relationships
- Include temporal relationships when relevant
${task.instructions ? `\nAdditional instructions: ${task.instructions}` : ''}`;

      default:
        return `You are a document analysis expert. Analyze the provided document and extract relevant information based on the specified task.
${task.instructions ? `\nInstructions: ${task.instructions}` : ''}`;
    }
  }

  private static getOutputInstructions(task: AnalysisTask): string {
    switch (task.type) {
      case 'summarize':
        return `Please provide your response in the following JSON format:
{
  "summary": "Your concise summary here",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "wordCount": number
}`;

      case 'extract_entities':
        return `Please provide your response in the following JSON format:
{
  "entities": [
    {
      "name": "Entity name",
      "type": "person|organization|location|concept|other",
      "confidence": 0.95,
      "mentions": 3
    }
  ]
}`;

      case 'analyze_sentiment':
        return `Please provide your response in the following JSON format:
{
  "sentiment": 0.2,
  "label": "positive|negative|neutral",
  "confidence": 0.85,
  "keyPhrases": ["phrase that indicates sentiment"]
}`;

      case 'generate_keywords':
        return `Please provide your response in the following JSON format:
{
  "keywords": [
    {
      "term": "keyword or phrase",
      "importance": 0.9,
      "frequency": 5
    }
  ]
}`;

      case 'extract_relationships':
        return `Please provide your response in the following JSON format:
{
  "relationships": [
    {
      "source": "Entity A",
      "target": "Entity B",
      "type": "relationship_type",
      "confidence": 0.8
    }
  ]
}`;

      default:
        return `Please provide your response in a clear, structured JSON format appropriate for the analysis task.`;
    }
  }

  static buildMultiDocumentPrompt(documents: Array<{id: string, content: string}>, task: string): string {
    const docList = documents.map((doc, index) =>
      `Document ${index + 1} (ID: ${doc.id}):
---
${doc.content}
---`
    ).join('\n\n');

    return `You are a multi-document analysis expert. Your task is to ${task} across the following documents.

${docList}

Please analyze these documents collectively and provide insights that consider their relationships, similarities, and differences.

Provide your response in a structured JSON format with clear sections for each type of analysis requested.`;
  }

  static buildKnowledgeGraphPrompt(content: string): string {
    return `You are a knowledge graph expert. Your task is to extract entities and relationships from the provided content to build a comprehensive knowledge graph.

Document Content:
---
${content}
---

Guidelines:
- Extract all important entities (people, organizations, locations, concepts, events)
- Identify relationships between entities with specific relationship types
- Provide confidence scores for both entities and relationships
- Create a hierarchical structure where appropriate
- Include temporal relationships when dates/times are mentioned

Please provide your response in the following JSON format:
{
  "nodes": [
    {
      "id": "unique_id",
      "label": "Entity Name",
      "type": "person|organization|location|concept|event|other",
      "properties": {
        "description": "Brief description",
        "aliases": ["alternative names"],
        "importance": 0.8
      }
    }
  ],
  "edges": [
    {
      "source": "source_entity_id",
      "target": "target_entity_id",
      "relationship": "relationship_type",
      "weight": 0.9,
      "properties": {
        "description": "Relationship description",
        "temporal": "time information if relevant"
      }
    }
  ]
}`;
  }

  static buildQueryPrompt(query: string, context: string): string {
    return `You are a helpful AI assistant with access to document context. Answer the user's question based on the provided context.

Context:
---
${context}
---

User Question: ${query}

Guidelines:
- Base your answer primarily on the provided context
- If the context doesn't contain sufficient information, clearly state this
- Provide specific references to relevant parts of the context
- Be accurate and avoid making assumptions beyond the given information
- If asked for analysis or interpretation, explain your reasoning

Please provide a clear, helpful response to the user's question.`;
  }
}