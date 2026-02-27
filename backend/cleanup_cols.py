"""
Cleanup script: removes duplicate/junk columns from kanban.db
Keeps only the 4 default columns (todo, inprogress, review, done)
and any other unique-named columns the user intentionally created.
Run once then delete this file.
"""
import sqlite3

conn = sqlite3.connect("kanban.db")
cur = conn.cursor()

cur.execute('SELECT id, name FROM "columns" ORDER BY "order"')
cols = cur.fetchall()
print(f"Found {len(cols)} columns:")
for c in cols:
    print(f"  {c[0]:30s}  {c[1]}")

# Mark junk: keep only first occurrence of each name
seen = {}
to_delete = []
for cid, cname in cols:
    key = cname.strip().lower()
    if key in seen:
        to_delete.append((cid, cname))
    else:
        seen[key] = cid

print(f"\nWill delete {len(to_delete)} duplicate columns:")
for cid, cname in to_delete:
    print(f"  {cid:30s}  {cname}")

if to_delete:
    confirm = input("\nProceed? (y/n): ").strip().lower()
    if confirm == "y":
        for cid, cname in to_delete:
            # Move tasks in this column to the first kept column
            first_col = list(seen.values())[0]
            cur.execute("UPDATE tasks SET status=? WHERE status=?", (first_col, cid))
            cur.execute('DELETE FROM "columns" WHERE id=?', (cid,))
        conn.commit()
        print(f"Deleted {len(to_delete)} columns. Done.")
    else:
        print("Aborted.")
else:
    print("No duplicates found.")

cur.execute('SELECT id, name FROM "columns" ORDER BY "order"')
remaining = cur.fetchall()
print(f"\nRemaining {len(remaining)} columns:")
for c in remaining:
    print(f"  {c[0]:30s}  {c[1]}")

conn.close()
