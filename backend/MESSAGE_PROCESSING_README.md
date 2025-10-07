# Enhanced Message Processing System

This system provides a sophisticated 3-level LLM categorization pipeline for processing customer messages and automatically organizing them into themes, sub-themes, and features.

## Overview

The Enhanced Message Processor uses OpenAI GPT-4 to analyze customer messages through three sequential steps:

1. **Theme Categorization** - Match message to existing parent themes
2. **Sub-theme Categorization** - Match message to specific sub-themes within the selected theme
3. **Feature Matching & Signal Extraction** - Either match to existing features or create new ones, while extracting important signals

## Files

- `enhanced_message_processor.py` - Main processing script
- `test_message_processor.py` - Test script with examples
- `MESSAGE_PROCESSING_README.md` - This documentation

## Prerequisites

1. **OpenAI API Key**: Set `OPENAI_API_KEY` in your `.env` file
2. **Database Connection**: Ensure your database is accessible and contains:
   - Messages to process
   - Existing themes (with hierarchical parent-child relationships)
   - Existing features
3. **Python Dependencies**: `openai`, `sqlalchemy`, and all FastAPI app dependencies

## Quick Start

### 1. Test the System (Dry Run)

```bash
# Run prerequisites check and basic test
python test_message_processor.py

# Test with specific workspace (dry run)
python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 --limit 5 --dry-run --verbose
```

### 2. Process Messages (Live)

```bash
# Process 50 messages
python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874 --limit 50

# Process all unprocessed messages
python enhanced_message_processor.py --workspace-id 647ab033-6d10-4a35-9ace-0399052ec874
```

## Command Line Options

- `--workspace-id` (required): UUID of the workspace to process
- `--limit`: Number of messages to process (default: all unprocessed)
- `--dry-run`: Run without saving changes to database
- `--verbose`: Enable detailed logging

## Processing Pipeline

### Step 1: Theme Categorization
- **Input**: Message content, channel, author, timestamp
- **Context**: List of all parent themes in workspace
- **Output**: Selected theme ID with confidence score
- **LLM Model**: GPT-4o
- **Max Tokens**: 1000

### Step 2: Sub-theme Categorization
- **Input**: Message + selected parent theme
- **Context**: List of sub-themes under the selected parent theme
- **Output**: Selected sub-theme ID with confidence score
- **LLM Model**: GPT-4o
- **Max Tokens**: 1000
- **Note**: Only runs if sub-themes exist for the selected parent theme

### Step 3: Feature Matching & Signal Extraction
- **Input**: Message + target theme/sub-theme
- **Context**: List of existing features in the target theme
- **Output**: Either:
  - Match to existing feature + extracted signals
  - New feature creation + extracted signals
  - Ignore (not a feature request)
- **LLM Model**: GPT-4o
- **Max Tokens**: 2000

## Signal Extraction

The system automatically extracts important signals from messages including:

- **Urgency indicators**: "urgent", "blocking", "critical"
- **User pain points**: Friction and difficulties mentioned
- **Use cases**: Specific scenarios and workflows
- **Business impact**: Revenue, efficiency, or competitive mentions
- **User sentiment**: Positive/negative feedback
- **Technical constraints**: Implementation requirements or limitations

## Database Changes

### Messages
- `is_processed` field set to `True`
- `processed_at` timestamp updated

### Features
- **Existing features**:
  - `mention_count` incremented
  - `last_mentioned` timestamp updated
  - Message linked via `feature_messages` table
- **New features**:
  - Created with extracted name, description, urgency
  - `mention_count` set to 1
  - Linked to appropriate theme/sub-theme
  - Message linked via `feature_messages` table

## Output and Statistics

The processor provides detailed statistics:

```
ENHANCED MESSAGE PROCESSING STATISTICS
========================================
Total messages found: 150
Messages processed: 147
Step 1 (Theme) success: 145
Step 2 (Sub-theme) success: 89
Step 3 (Feature) success: 142
Features created: 23
Features updated: 119
Errors: 3
```

## Error Handling

- **API Errors**: Individual message failures don't stop the entire process
- **JSON Parsing**: Robust parsing handles malformed LLM responses
- **Database Errors**: Transactions are rolled back on failure
- **Rate Limits**: Sequential processing to avoid API rate limits

## Best Practices

1. **Start Small**: Use `--limit 10 --dry-run` for initial testing
2. **Monitor Costs**: Each message makes 2-3 OpenAI API calls
3. **Review Results**: Check a few processed messages manually
4. **Backup Database**: Before running large batches
5. **Set Limits**: Use limits during development to avoid unexpected costs

## Example Usage Scenarios

### Development Testing
```bash
# Quick test with 5 messages
python enhanced_message_processor.py --workspace-id YOUR_ID --limit 5 --dry-run --verbose
```

### Small Batch Processing
```bash
# Process 50 messages carefully
python enhanced_message_processor.py --workspace-id YOUR_ID --limit 50
```

### Full Workspace Processing
```bash
# Process all unprocessed messages
python enhanced_message_processor.py --workspace-id YOUR_ID
```

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY not found"**
   - Add your OpenAI API key to the `.env` file
   - Ensure the `.env` file is in the backend directory

2. **"No parent themes available"**
   - Create at least one parent theme in your workspace
   - Themes should have proper hierarchical structure

3. **"Workspace not found"**
   - Verify the workspace ID is correct
   - Check database connectivity

4. **API Rate Limits**
   - The script processes messages sequentially to avoid limits
   - Add delays between batches if needed

### Getting Help

- Check the test script output: `python test_message_processor.py`
- Enable verbose logging: `--verbose`
- Start with small limits: `--limit 5`
- Use dry-run mode: `--dry-run`

## Performance Considerations

- **Processing Speed**: ~3-5 seconds per message (due to LLM calls)
- **API Costs**: Approximately $0.01-0.03 per message (depending on content length)
- **Memory Usage**: Loads all themes/features into memory (minimal impact)
- **Database Impact**: One transaction per message batch

## Integration with HeadwayHQ

This processor integrates seamlessly with the existing HeadwayHQ system:

- Uses existing database models (`Message`, `Feature`, `Theme`)
- Respects workspace boundaries
- Updates feature counts and relationships
- Maintains message-feature associations
- Works with the hierarchical theme system