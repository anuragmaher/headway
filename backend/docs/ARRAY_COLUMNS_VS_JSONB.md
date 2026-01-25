# Array Columns vs JSONB Mappings - Performance Comparison

## Current Approach (JSONB Mappings)

### Query Pattern
```sql
WHERE theme_id = '...' OR 
  EXISTS (SELECT 1 FROM jsonb_array_elements(extracted_data->'mappings') 
          AS mapping WHERE (mapping->>'theme_id')::uuid = '...')
```

### Performance
- **Query Time**: ~10-50ms (with GIN index)
- **Index**: GIN on `extracted_data->'mappings'`
- **Complexity**: Requires EXISTS subquery with array expansion
- **Scalability**: Slower as mappings arrays grow

## Proposed Approach (Array Columns)

### Query Pattern
```sql
WHERE theme_id = ANY(theme_ids)::uuid[])
-- Or even simpler:
WHERE 'theme-id-here' = ANY(theme_ids)
```

### Performance
- **Query Time**: ~1-5ms (with GIN index on array)
- **Index**: GIN on `theme_ids` and `sub_theme_ids` arrays
- **Complexity**: Simple array containment check
- **Scalability**: O(log n) with GIN index, constant overhead

## Comparison

| Aspect | JSONB Mappings | Array Columns |
|--------|----------------|---------------|
| **Query Speed** | 10-50ms | 1-5ms |
| **Query Complexity** | Complex (EXISTS subquery) | Simple (ANY operator) |
| **Index Efficiency** | Good (GIN on JSONB) | Excellent (GIN on array) |
| **Storage** | Single JSONB field | 2 additional array columns |
| **Data Sync** | Single source | Need to sync with mappings |
| **Flexibility** | Very flexible | Less flexible (only IDs) |

## Recommendation

✅ **Use Array Columns** for:
- Fast filtering by theme/sub-theme
- Better query performance
- Simpler SQL queries
- Better index utilization

✅ **Keep JSONB Mappings** for:
- Full mapping details (interpreted_need, verbatim_quote, reasoning)
- Flexible schema for future fields
- Complete audit trail

## Implementation Strategy

1. Add `theme_ids UUID[]` and `sub_theme_ids UUID[]` columns
2. Populate from `extracted_data.mappings[]` on insert/update
3. Use array columns for filtering (fast)
4. Use JSONB mappings for detailed data (flexible)
5. Create GIN indexes on both arrays

## Migration Plan

1. Add columns (nullable initially)
2. Backfill from existing mappings
3. Update insert/update logic to populate arrays
4. Switch queries to use arrays
5. Make arrays NOT NULL after backfill
