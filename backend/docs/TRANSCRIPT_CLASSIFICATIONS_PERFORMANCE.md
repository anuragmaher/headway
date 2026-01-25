# Transcript Classifications Query Performance

## Current Implementation

### Query Pattern
When filtering transcript classifications by `theme_id` or `sub_theme_id`, the query checks:
1. **Top-level fields**: `theme_id` and `sub_theme_id` columns (fast, uses B-tree index)
2. **Mappings array**: All mappings in `extracted_data.mappings[]` JSONB array (uses GIN index)

### Indexes

#### Existing Indexes
- ✅ **GIN index on `extracted_data`**: `idx_transcript_classifications_extracted_data`
  - Helps with general JSONB queries
  - Size: ~20-30% of table size (typical for GIN indexes)

- ✅ **GIN index on `extracted_data->'mappings'`**: `idx_transcript_classifications_mappings_gin` (new)
  - Specifically optimizes queries on the mappings array
  - More efficient than the full extracted_data index for array queries
  - Size: ~10-15% of table size

- ✅ **B-tree indexes**: On `theme_id`, `sub_theme_id`, `workspace_id`
  - Very fast for top-level field lookups
  - Used first in query planning

### Query Performance

#### Best Case (Top-level match)
- **Query**: Filter by `theme_id` where top-level field matches
- **Performance**: ~1-5ms (uses B-tree index)
- **Index**: `idx_transcript_classifications_theme`

#### Typical Case (Mappings array search)
- **Query**: Filter by `sub_theme_id` found in mappings array
- **Performance**: ~10-50ms (uses GIN index on mappings)
- **Index**: `idx_transcript_classifications_mappings_gin`
- **Scales**: O(log n) with GIN index, but array expansion adds overhead

#### Worst Case (Large arrays, many rows)
- **Query**: Filter with large mappings arrays (>10 mappings per transcript)
- **Performance**: ~50-200ms (depends on array size and total rows)
- **Bottleneck**: `jsonb_array_elements()` expansion

## Optimization Strategies

### 1. Current Approach (Recommended for <100K rows)
✅ **Pros:**
- Flexible schema (can add new fields to mappings)
- No denormalization needed
- Works well with GIN indexes

⚠️ **Cons:**
- Array expansion has overhead
- Slower as mappings arrays grow

### 2. Denormalization (Consider for >100K rows)
If performance becomes an issue, consider:

**Option A: Store theme/sub-theme ID arrays**
```sql
ALTER TABLE transcript_classifications 
ADD COLUMN theme_ids UUID[],
ADD COLUMN sub_theme_ids UUID[];

-- Populate from mappings array
UPDATE transcript_classifications
SET theme_ids = (
  SELECT array_agg((mapping->>'theme_id')::uuid)
  FROM jsonb_array_elements(extracted_data->'mappings') AS mapping
  WHERE mapping->>'theme_id' IS NOT NULL
);
```

**Option B: Junction table**
```sql
CREATE TABLE transcript_classification_mappings (
  classification_id UUID REFERENCES transcript_classifications(id),
  theme_id UUID REFERENCES themes(id),
  sub_theme_id UUID REFERENCES sub_themes(id),
  PRIMARY KEY (classification_id, theme_id, sub_theme_id)
);
```

### 3. Materialized View (For complex aggregations)
If you need frequent counts/aggregations:
```sql
CREATE MATERIALIZED VIEW transcript_classification_counts AS
SELECT 
  theme_id,
  sub_theme_id,
  COUNT(*) as count
FROM transcript_classifications
GROUP BY theme_id, sub_theme_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY transcript_classification_counts;
```

## Monitoring

### Check Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename = 'transcript_classifications'
ORDER BY idx_scan DESC;
```

### Check Query Performance
```sql
EXPLAIN ANALYZE
SELECT * FROM transcript_classifications
WHERE workspace_id = '...'
  AND (
    sub_theme_id = '...' OR
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(extracted_data->'mappings') AS mapping
      WHERE (mapping->>'sub_theme_id')::uuid = '...'
    )
  );
```

### Index Size
```sql
SELECT 
  pg_size_pretty(pg_relation_size('idx_transcript_classifications_extracted_data')) as extracted_data_index_size,
  pg_size_pretty(pg_relation_size('idx_transcript_classifications_mappings_gin')) as mappings_index_size,
  pg_size_pretty(pg_relation_size('transcript_classifications')) as table_size;
```

## Recommendations

### Current Scale (<10K classifications)
- ✅ Current approach is fine
- ✅ GIN indexes provide good performance
- ✅ No changes needed

### Medium Scale (10K-100K classifications)
- ✅ Current approach should still work
- ⚠️ Monitor query performance
- ⚠️ Consider caching counts in application layer

### Large Scale (>100K classifications)
- ⚠️ Consider denormalization (Option A or B above)
- ⚠️ Use materialized views for counts
- ⚠️ Implement pagination (already done)
- ⚠️ Consider read replicas for analytics queries

## Migration

To apply the optimization index:
```bash
cd backend
alembic upgrade head
```

This will create the `idx_transcript_classifications_mappings_gin` index.

## Notes

- GIN indexes are larger than B-tree indexes but provide fast JSONB queries
- Index maintenance happens automatically on INSERT/UPDATE
- Consider `VACUUM ANALYZE` periodically to keep statistics fresh
- Monitor index bloat if you have many updates
