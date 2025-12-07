# How to View Data in Supabase Dashboard

## ✅ Data is in the Database!

The check confirmed:
- **1 record** in `trending_topics` table
- **5 topics** cached
- **Status**: ✅ VALID (expires at 3:18 AM)

## View in Supabase Dashboard

### Step 1: Open Supabase Dashboard
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Select your project: `ixonhypcadjznduyqaea`

### Step 2: View Table Data
1. Click **Table Editor** in the left sidebar
2. Find and click on **`trending_topics`** table
3. You should see 1 row with:
   - `id`: 1
   - `generated_at`: Recent timestamp
   - `expires_at`: 30 minutes from generated_at
   - `tweets`: JSONB column with all 5 topics

### Step 3: View JSON Data
1. Click on the row to expand it
2. Click on the `tweets` column
3. You'll see a JSON editor with all 5 trending topics

### Step 4: View in SQL Editor (Optional)
Run this query:
```sql
SELECT 
  id,
  generated_at,
  expires_at,
  jsonb_array_length(tweets) as topic_count
FROM trending_topics
ORDER BY generated_at DESC;
```

## What You Should See

The `tweets` JSONB column contains an array like:
```json
[
  {
    "id": "trend-0-...",
    "trendTitle": "Google Year in Search",
    "content": "...",
    "topic": "Tech",
    ...
  },
  ...
]
```

## Troubleshooting

### "Table doesn't exist"
- Go to **SQL Editor**
- Run the SQL from `supabase/schema.sql`

### "No rows found"
- Run `npm run populate-db` again
- Check the console output for errors

### "Can't see the data"
- Make sure you're in the correct project
- Check the project ref matches: `ixonhypcadjznduyqaea`
- Refresh the Table Editor page

## Next Steps

Now that data is in the database:
1. **Restart your dev server**: `npm run dev`
2. The app should load topics instantly from cache
3. Check browser console for: `✅ Got 5 topics from cache`

