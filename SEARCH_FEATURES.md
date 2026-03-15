# Enhanced Search Features Documentation

## Overview

Your app now supports three powerful search modes with AI-powered metadata extraction and tag-based filtering.

## Features

### 1. **Three Search Modes**

#### Keyword Search
- Traditional full-text search using SQLite FTS5
- Highlights matching keywords in results
- Best for: Searching specific terms or phrases
- Uses: BM25 relevance ranking

#### Semantic Search  
- Vector-based similarity search using embeddings
- Finds conceptually similar content
- Best for: Understanding meaning and context
- Shows: Relevance scores (cosine similarity)

#### AI Search (Claude)
- Uses Claude AI to analyze and restructure results
- Provides summaries and key insights
- Returns: Structured analysis with relevance explanation
- Shows: Key points extracted by AI

### 2. **Metadata Extraction**

When documents are indexed, Claude automatically extracts:
- **Tags**: 3-7 relevant topic tags describing the document
- **Authors**: Author names mentioned in the document
- **Publish Date**: Publication date (if found), in YYYY-MM-DD format

### 3. **Tag-Based Filtering**

- Filter search results by clicking on tags
- Select multiple tags to narrow results
- Tags appear automatically after searching

## Setup

### Environment Variables

Add your Claude API key to your `.env.local` file:

```bash
ANTHROPIC_API_KEY=sk_your_key_here
```

Get your API key from: https://console.anthropic.com/

### Data Directory

Ensure you have a data folder with PDFs:

```bash
mkdir -p data
# Add your PDF files to the data folder
```

## How It Works

### Indexing Flow
1. PDFs in the `data/` folder are discovered
2. Text is extracted and chunked
3. **Embeddings** are generated for semantic search
4. **Claude extracts metadata** (tags, authors, dates)
5. Everything is stored in SQLite with full-text index

### Search Flow
1. User enters a query and selects search mode
2. Results are retrieved based on mode:
   - **Keyword**: FTS5 full-text search
   - **Semantic**: Vector similarity comparison
   - **AI**: Semantic search + Claude restructuring
3. All results show extracted metadata
4. User can filter by tags

## Database Schema

The enhanced embeddings table includes:

```sql
CREATE TABLE embeddings (
  id TEXT,
  source TEXT,
  pageNumber INTEGER,
  chunkIndex INTEGER,
  text TEXT,
  embedding BLOB,
  tags TEXT,          -- JSON array of strings
  authors TEXT,       -- JSON array of strings
  publishDate TEXT,   -- ISO date string
  PRIMARY KEY (source, chunkIndex)
);
```

## API Functions

### New Actions

```typescript
// Existing
keywordSearch(query: string) -> SearchResult[]
semanticSearch(query: string) -> SearchResult[]

// New
aiSearchAction(query: string) -> AIResult[]
```

### API Response Types

```typescript
interface SearchResult {
  id: string;
  source: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  rank: number;
  tags?: string[];
  authors?: string[];
  publishDate?: string;
}

interface AIResult {
  source: string;
  summary: string;
  relevance: string;
  keyPoints: string[];
  text?: string;
}
```

## Component Changes

### Updated Files
- `app/search/page.tsx` - Added metadata extraction during indexing
- `app/search/search-client.tsx` - Added AI mode button, tag filtering UI
- `app/search/actions.ts` - Added AI search action
- `app/services/db-service.ts` - Updated schema and queries for metadata
- `app/services/embedding-service.ts` - Updated EmbeddedChunk type

### New Files
- `app/services/ai-metadata-service.ts` - Claude integration for metadata extraction and AI search

## Usage Examples

### Keyword Search
Search for: "regulations"
- Shows exact keyword matches
- Highlights found keywords
- Ranked by relevance

### Semantic Search  
Search for: "how should companies handle data"
- Finds semantically similar content
- Returns conceptually related documents
- Shows similarity scores

### AI Search
Search for: "what are the main compliance requirements"
- Gets top semantic matches
- Claude analyzes and summarizes each
- Extracts key points
- Explains relevance

Then filter with tags:
- Click "compliance" tag to show only compliance-related results
- Click multiple tags for intersection filtering

## Performance Notes

- **First indexing**: May take time due to AI metadata extraction
- **Subsequent indexing**: Much faster (metadata only for new docs)
- **Search**: All modes are fast (sub-second)
- **AI mode**: Slightly slower than other modes (Claude API call)

## Customization

### Change AI Model
In `app/services/ai-metadata-service.ts`:
```typescript
model: "claude-3-5-sonnet-20241022" // Change to other Claude models
```

### Adjust Number of Tags
In `app/services/ai-metadata-service.ts`:
```typescript
// Modify the prompt to request more/fewer tags
// "tags": "3-7 tags" // Change the range
```

### Metadata Extraction Parameters
In `app/search/page.tsx`:
```typescript
const sampleText = embedded.slice(0, Math.min(3, embedded.length))
// Increase 3 to use more chunks for metadata extraction
```
