# Array Column Indexes - Optimization Guide

## Current Indexes

### GIN Indexes on Array Columns
```sql
CREATE INDEX idx_transcript_classifications_theme_ids 
ON transcript_classifications USING GIN (theme_ids);

CREATE INDEX idx_transcript_classifications_sub_theme_ids 
ON transcript_classifications USING GIN (sub_theme_ids);
```

## Query Operators

### ✅ Recommended: `@>` (Contains) Operator
```sql
WHERE theme_ids @> ARRAY['theme-uuid']::uuid[]
```
- **Index Usage**: Fully optimized with GIN index
- **Performance**: O(log n) - very fast
- **Best for**: Single value containment checks

### ⚠️ Less Optimal: `ANY()` Operator
```sql
WHERE 'theme-uuid' = ANY(theme_ids)
```
- **Index Usage**: Partial - GIN helps but not fully optimized
- **Performance**: Slower than `@>` operator
- **Use when**: Need to check multiple values

## Composite Indexes Consideration

### Current Query Pattern
```sql
WHERE workspace_id = '...' 
  AND (theme_id = '...' OR theme_ids @> ARRAY['...']::uuid[])
```

### Potential Optimization
If queries always filter by `workspace_id` first, consider composite indexes:

```sql
-- Option 1: Composite B-tree + GIN (if workspace_id filter is very selective)
CREATE INDEX idx_transcript_classifications_workspace_theme_ids 
ON transcript_classifications (workspace_id) 
INCLUDE (theme_ids);

-- Option 2: Partial GIN index (if workspace_id is always present)
CREATE INDEX idx_transcript_classifications_theme_ids_gin 
ON transcript_classifications USING GIN (theme_ids) 
WHERE workspace_id IS NOT NULL;
```

**However**, since we already have:
- `idx_transcript_classifications_workspace` (B-tree on workspace_id)
- `idx_transcript_classifications_theme_ids` (GIN on theme_ids)

PostgreSQL can use **bitmap index scan** to combine both indexes efficiently, so composite indexes may not be necessary unless:
- You have millions of rows per workspace
- The workspace_id filter is not selective enough

## Performance Characteristics

| Query Pattern | Index Used | Performance |
|--------------|------------|-------------|
| `workspace_id = X AND theme_id = Y` | B-tree on workspace_id + B-tree on theme_id | Very Fast |
| `workspace_id = X AND theme_ids @> ARRAY[Y]` | B-tree on workspace_id + GIN on theme_ids | Very Fast |
| `workspace_id = X AND theme_ids @> ARRAY[Y, Z]` | B-tree on workspace_id + GIN on theme_ids | Fast |
| `theme_ids @> ARRAY[Y]` (no workspace filter) | GIN on theme_ids | Fast (but less selective) |

## Recommendations

1. ✅ **Keep current GIN indexes** - They're optimal for array containment
2. ✅ **Use `@>` operator** instead of `ANY()` for better index utilization
3. ⚠️ **Monitor query performance** - If slow, consider composite indexes
4. ✅ **Keep workspace_id B-tree index** - Essential for filtering

## Index Maintenance

GIN indexes are larger than B-tree indexes but provide excellent query performance:
- **Size**: ~2-3x larger than B-tree for same data
- **Update Cost**: Slightly higher on INSERT/UPDATE
- **Query Benefit**: 10-100x faster for containment queries

For typical workloads (< 1M rows), current indexes are optimal.
