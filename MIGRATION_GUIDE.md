# Migration Guide: One Row Per Trend

## What Changed

**Before**: All trending topics stored as a JSON array in one row
**After**: Each trending topic is stored as a separate row

## Benefits

✅ **Better Querying**: Can filter, search, and update individual trends  
✅ **Better Performance**: Indexes work better on individual rows  
✅ **Flexible Updates**: Update one trend without regenerating all  
✅ **Better Analytics**: Can track individual trend performance  

## Migration Steps

### Option 1: Fresh Start (Recommended)

1. **Create new table**:
   ```sql
   -- Run this in Supabase SQL Editor
   -- From: supabase/schema-v2.sql
   ```

2. **Populate new table**:
   ```bash
   npm run populate-db
   ```

3. **Old table will be ignored** (or you can drop it later)

### Option 2: Keep Both Tables

The code supports both table structures:
- Tries `trending_topics_v2` first (new structure)
- Falls back to `trending_topics` (old structure) if needed

## New Table Structure

```sql
trending_topics_v2
├── id (BIGSERIAL PRIMARY KEY)
├── tweet_id (TEXT) - Unique ID for the trend
├── generated_at (TIMESTAMP) - When this batch was generated
├── expires_at (TIMESTAMP) - When this record expires
├── tweet_data (JSONB) - Full tweet/trend data
└── version (INTEGER)
```

## Querying Examples

### Get all trends from latest batch
```sql
SELECT tweet_data 
FROM trending_topics_v2
WHERE generated_at = (
  SELECT MAX(generated_at) 
  FROM trending_topics_v2
  WHERE expires_at > NOW()
);
```

### Get a specific trend
```sql
SELECT tweet_data 
FROM trending_topics_v2
WHERE tweet_id = 'trend-0-1234567890'
ORDER BY generated_at DESC
LIMIT 1;
```

### Count trends per batch
```sql
SELECT 
  generated_at,
  COUNT(*) as trend_count
FROM trending_topics_v2
GROUP BY generated_at
ORDER BY generated_at DESC;
```

## Backward Compatibility

The code automatically:
- Tries new table structure first
- Falls back to old structure if new table doesn't exist
- Works with both during migration period

## Next Steps

1. Run the new schema SQL in Supabase
2. Run `npm run populate-db` to populate new table
3. Test the app - it should work the same but with better structure!

