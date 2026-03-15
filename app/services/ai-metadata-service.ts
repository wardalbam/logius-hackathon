import Anthropic from "@anthropic-ai/sdk";
import "server-only";

interface MetadataExtraction {
  tags: string[];
  authors: string[];
  publishDate: string | null;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Extract metadata (tags, authors, publish date) from document text using Claude.
 */
export async function extractMetadataFromText(
  text: string,
  documentName: string,
): Promise<MetadataExtraction> {
  try {
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze the following document text and extract metadata. Return a JSON object with the following structure:
{
  "tags": ["tag1", "tag2", ...],
  "authors": ["author1", "author2", ...],
  "publishDate": "YYYY-MM-DD" or null
}

Guidelines:
- tags: Extract 3-7 relevant topic tags that describe the document content
- authors: Extract author names if mentioned in the text. If no authors are found, return an empty array.
- publishDate: Extract the publication date if found in the text in YYYY-MM-DD format. If not found, return null.

Document name: ${documentName}

Text:
${text}`,
        },
      ],
    });

    // Extract the JSON from the response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { tags: [], authors: [], publishDate: null };
    }

    const extracted = JSON.parse(jsonMatch[0]) as MetadataExtraction;
    return {
      tags: Array.isArray(extracted.tags) ? extracted.tags : [],
      authors: Array.isArray(extracted.authors) ? extracted.authors : [],
      publishDate: extracted.publishDate || null,
    };
  } catch (error) {
    console.error("Error extracting metadata:", error);
    return { tags: [], authors: [], publishDate: null };
  }
}

/**
 * Use AI to search documents semantically and restructure results with insights
 */
export async function aiSearch(
  query: string,
  searchResults: Array<{ text: string; source: string }>,
): Promise<
  Array<{
    source: string;
    summary: string;
    relevance: string;
    keyPoints: string[];
  }>
> {
  if (searchResults.length === 0) {
    return [];
  }

  try {
    const resultsText = searchResults
      .map((r) => `Source: ${r.source}\nContent: ${r.text}`)
      .join("\n\n---\n\n");

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `User query: "${query}"

Below are search results from the document database. Please analyze each result and provide structured insights.

Return a JSON array with objects containing:
{
  "source": "document name",
  "summary": "Brief summary of how this document relates to the query",
  "relevance": "Why this is relevant to the query",
  "keyPoints": ["point1", "point2", "point3"]
}

Search Results:
${resultsText}

Provide insights for each source document.`,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Error in AI search:", error);
    return [];
  }
}
